---
title: 从零开始的堆利用 00
published: 2026-07-22T03:41:08.957Z
description: 堆利用的第一步，认识堆
tags:
  - pwn
  - glibc
category: Heap
draft: false
lang: zh_CN
---

# 堆利用基础

> *更新于 2026/10/24* 

堆是 **虚拟内存空间的一段连续的线性区域** ，提供动态分配的内存，允许程序申请大小未知的内存。在用户与操作系统之间，作为动态内存管理的中间人，响应程序的申请内存请求，向操作系统申请内存，然后返回给程序。并且管理用户所释放的内存，适时归还给操作系统。

glibc 使用 ptmalloc2 作为堆管理器。

## 申请内存时的系统调用

- brk -> 小内存
- mmap -> 大内存

## Arena

内存分配区，可以理解为堆管理器所持有的内存池。

堆管理器与程序的内存交易发生在arena中，可以理解为堆管理器向操作系统批发来的由冗余的内存组成的库存。

> 操作系统 -> 堆管理器 -> 程序
> 物理内存 -> arena -> 可用内存

在 Linux 中，程序如果直接向操作系统申请内存，需要通过系统调用（比如 `brk` 或 `mmap`）。系统调用的代价非常昂贵。为了解决这个问题，堆管理器不会等程序要内存了才去操作系统拿，而是提前**向操作系统申请一大块内存**，并把这块内存放在 Arena中，**当程序需要内存时，堆管理器直接从 Arena 中切下一小块(Chunk)。同样的，被程序释放的内存也不会直接归还操作系统，由ptmalloc统一管理空闲的内存。**

## Chunk

程序申请内存的单位，堆管理器中管理内存的基本单位。 malloc()函数返回的指针指向一个 chunk 的数据区域

### 分类

按状态分为

- malloced： 已经分配且填写了数据的chunk
- free：被释放掉的malloced chunk成为free chunk

按大小：

- fast
- small
- large
- tcache

按特定功能：

- Top chunk：Arena中未被分配使用过的区域
- last remainder chunk（了解）：释放（free）大堆块之后，重新用 malloc 分割 chunk 时剩余的部分

### 大小 / 结构


 **堆的大小必须是 MALLOC_ALIGNMENT 的整数倍**。如果申请的大小不是，会被转换为相应的最小值，32 位系统中， MALLOC_ALIGNMENT 可能是 0x4 或 0x8 ；64 位系统中，MALLOC_ALIGNMENT 是 0x8 或 0x10。可以发现，不管 size 的大小如何变，size 的**二进制低三位**都为 0，为了不浪费这三个比特位，他们从高到低分别用来表示（ A M P ）：

- NON_MAIN_ARENA：记录- 当前chunk是否不属于主线程，1表示不属于，0表示属于  
- IS_MAPPED：记录当前 chunk 是否由 mmap 分配
- PREV_INUSE：记录前一个 chunk 是否被使用

chunk结构如下：

- prev_size：记录上一个 chunk 的大小，当上一个 chunk 为 free chunk 时生效
- size：
  - size of chunk
  - A
  - M
  - P
- fd:   bin中指向下一个（不一定物理相邻）空闲的chunk
- bk:  bin中指向上一个（不一定物理相邻）空闲的chunk，仅为处于双向链表的bin中的free chunk时生效
- fd_nextsize：为large free chunk时生效    
- bk_nextsize：为large free chunk时生效

## Bin

用户释放掉的 chunk 不会马上归还给系统，ptmalloc 会统一管理 heap 和 mmap 映射区域中的空闲的 chunk。当用户再一次请求分配内存时，ptmalloc 分配器会试图在空闲的 chunk 中挑选一块合适的给用户。这样可以避免频繁的系统调用，降低内存分配的开销。

ptmalloc 采用分箱式方法对空闲的 `chunk` 进行管理。首先，它会根据空闲的 chunk 的大小以及使用状态初步分为 4 类：fast bins、 small bins、 large bins、 unsorted bin、 在 libc-2.26 之后引入了tcache bins。

相似大小的 chunk 会用**链表**链接起来。也就是说，在每类 bin 的内部仍然会有多个**互不相关的链表**来保存不同大小的 chunk。

| bin类型      | 大小范围   | 链表数量（数组大小） | 结构         |
| ------------ | ---------- | -------------------- | ------------ |
| fast bin     | 0x20-0x80  | 7                    | 单向链表     |
| tcache bin   | 0x20-0x410 | 64                   | 单向链表     |
| small bin    | 0x20-0x3F0 | 62                   | 双向循环链表 |
| large bin    | ≥0x400     | 63                   | 双向循环链表 |
| unsorted bin | 不限大小   | 1                    | 双向循环链表 |

在 glibc 的堆管理中，一个空闲 chunk 进入哪个 bin，**主要由 `free()` 时的 chunk 大小和对应 bin 的当前状态决定**。优先级通常是：**tcache → fastbin → unsorted bin → small/large bin**。

### tcache bins（第一优先级）
*   **进入条件**：chunk 大小在 **0x20 ~ 0x410**（64位默认）范围内，且对应 size class 的 tcache 链表**未满（< 7 个）**。
*   **关键点**：只要满足上述条件，free 会**最先**放入 tcache，且**不会**触发相邻空闲 chunk 的合并 。

### fast bins（第二优先级）
*   **进入条件**：chunk 大小 ≤ **0xa0**（默认 `global_max_fast`），且对应的 tcache bin **已满**。
*   **关键点**：fastbin 是单链表 LIFO，同样**不合并**。注意，如果 chunk 大小超过 0xa0 但 tcache 满了，它会直接跳过 fastbin 进入 unsorted bin 。

### unsorted bin（中轉站）
*   **进入条件**：不满足上述 fastbin/tcache 条件的所有其他 chunk（例如 tcache 满且尺寸较大的 chunk，或 fastbin 范围外的 chunk），在 free 时会**首先**进入这里。
*   **关键点**：它是个暂存区。后续调用 `malloc` 时，glibc 会扫描 unsorted bin，将不匹配的 chunk **归位**（sort）到 small bin 或 large bin 中 。

### small bins / large bins（最终归位）
这两个 bin **通常不是 `free` 的直接目标**，而是 `malloc` 整理 unsorted bin 时的产物：
*   **进入 small bin 条件**：当 `malloc` 扫描 unsorted bin 时，若 chunk 大小 **< 0x400** 且不匹配当前请求，它会被放入对应的 small bin。
*   **进入 large bin 条件**：若 chunk 大小 **≥ 0x400** 且不匹配，则被放入 large bin（内部按大小排序）。
*   **合并**：与 tcache/fastbin 不同，chunk 在进入 small/large bin 的过程中（或通过 `malloc_consolidate`），会尝试与相邻空闲 chunk 合并 。
