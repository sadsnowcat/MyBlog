---
title: "Linux kernel 入门之简易指北"
date: 2026-11-24T00:00:00
description: ""
tags:
  - "Kernel"
categories:
  - "Kernel"
---

# 00 Linux kernel 入门

> 看了这么久 kernel pwn ，还是感觉云里雾里，所以本期我们从编译一个内核开始进行 kernel 学习

> 正在更新中……

## 0. 开始之前

### 环境准备

笔者使用的机器是 wsl + ubuntu 20

需要下载一些编译所需的依赖，以及 qemu ，我们将通过 qemu 虚拟机来运行内核

```bash
sudo apt install git fakeroot build-essential ncurses-dev xz-utils qemu flex libncurses5-dev libssl-dev bc bison libglib2.0-dev libfdt-dev libpixman-1-dev zlib1g-dev libelf-dev
```

## 1. 编译内核镜像
### 1.1 获取内核源码

获取内核源码的方式多种多样，比如直接前往 [Linux Kernel Archive](https://www.kernel.org/) 下载对应版本的内核源码（当然你也可以选择镜像站）

```bash
wget https://cdn.kernel.org/pub/linux/kernel/v5.x/linux-5.11.tar.xz
```

完成下载后解压

```bash
unxz linux-5.11.tar.xz  
tar -xf linux-5.11.tar
```

笔者选择通过 git 获取全部源码。要开始使用 Linux 内核源码，我们需要克隆其参考 git 树，即由 Linus Torvalds 维护的那个。

```bash
git clone https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux
```

这将下载非常多的源码，请耐心等待。

Linus Torvalds 的 Linux 内核仓库包含了 Linux 的所有主要发布版本，但不包含稳定版本：它们由一个独立的团队维护，并托管在一个独立的仓库中。

我们将把这个独立的仓库作为另一个 remote 添加进来，以便能够使用稳定版本：

```bash
git remote add stable https://git.kernel.org/pub/scm/linux/kernel/git/stable/linux
git fetch stable
```

你可以通过 `git branch -a` 检查你当前拥有的版本。你也可以打开 `Makefile` 并查看其开头部分来核对这一信息。

```bash
make kernelversion
```

现在，基于某分支创建一个本地分支，笔者这里选择编译一个 5.0 版本的内核。

```bash
git checkout linux-5.0.y
git branch snowlinux-5.0
git checkout snowlinux-5.0

# 确认结果
git branch
```

再次使用 `make kernelversion` 命令检查版本。我检出的版本是 5.0.21 。

### 1.2 配置编译选项

在正式进行内核源码编译之前，我们还需要准备一份编译选项，其包含了内核编译相关的配置，通常存放于源码目录下的 `.config` 文件中。不过我们不需要从零开始手动编写，而是可以通过内核的编译配置系统进行动态生成。

通常情况下，我们在内核源码目录下使用如下命令进入图形化的内核配置面板， **这也是最常用的内核配置方法** ，其会读取 `.config` 文件的配置并允许我们在图形化的界面中进行修改，并在该文件不存在时则是会调用 `make defconfig` 先生成一份默认配置：

> 需要注意，图形化配置界面依赖于 ncurses 库，这通常可以从你的发行版仓库安装。

```bash
make menuconfig
```

保证勾选如下配置（默认都是勾选了的）：

- Kernel hacking —> Kernel debugging
- Kernel hacking —> Compile-time checks and compiler options —> Compile the kernel with debug info
- Kernel hacking —> Generic Kernel Debugging Instruments –> KGDB: kernel debugger
- kernel hacking —> Compile the kernel with frame pointers

### 1.3 开始编译

运行以下命令开始编译，生成内核镜像。

```bash
make -j$(nproc) bzImage
```

他们说要编译很久，但是我的机器 2 分钟就编译好了。

### 1.4 可能出现的错误

> 我编译的时候爆炸了，因为 retpoline 和 CET 冲突了。需要修改一下 `Makefile` 

```diff
-RETPOLINE_VDSO_CFLAGS_GCC := -mindirect-branch=thunk-inline -mindirect-branch-register
+RETPOLINE_VDSO_CFLAGS_GCC := -mindirect-branch=thunk-inline -mindirect-branch-register -fcf-protection=none
```

### 1.5 编译结果

完成后会出现如下信息

```
Kernel: arch/x86/boot/bzImage is ready  (#3)
```

我们主要关注生成的这两个文件：

**vmlinux** 原始内核文件

在当前目录下提取到`vmlinux`，为编译出来的原始内核文件

```bash
file vmlinux
vmlinux: ELF 64-bit LSB executable, x86-64, version 1 (SYSV), statically linked, BuildID[sha1]=cfb2254f3bd59a0e09df2d70894c21a47e6dd773, with debug_info, not stripped
```

**bzImage** 压缩内核镜像

在当前目录下的`arch/x86/boot/`目录下提取到`bzImage`，为压缩后的内核文件，适用于大内核。

> **zImage && bzImage**
> 
> > zImage–是vmlinux经过gzip压缩后的文件
> > 
> > bzImage–bz表示“big zImage”，不是用bzip2压缩的，而是要偏移到一个位置，使用gzip压缩的。两者的不同之处在于，zImage解压缩内核到低端内存(第一个 640K)，bzImage解压缩内核到高端内存(1M以上)。如果内核比较小，那么采用zImage或bzImage都行，如果比较大应该用bzImage。
> 
> [https://blog.csdn.net/xiaotengyi2012/article/details/8582886](https://blog.csdn.net/xiaotengyi2012/article/details/8582886)

## 2. 使用 busybox 构建文件系统

> [BusyBox](https://www.busybox.net/) 是一个集成了三百多个最常用 Linux 命令和工具的软件，包含了例如 ls 、cat 和 echo 等常见的命令，相比起各大发行版中常用的 [GNU core utilities](https://www.gnu.org/software/coreutils/) ，BusyBox 更加的轻量化，且更容易进行配置，因此我们将用 busybox 为我们的内核提供一个基本的用户环境
### 2.1 获取 busybox 源码

这里笔者选择通过 git 来获取 busybox 的源码。这个过程比拉取内核源码要快一些

```bash
git clone https://git.busybox.net/busybox
```

查看版本和切换分支，笔者这里选择了与 a3 一样的 1.33.0 的这个版本

```bash
# 查看版本
git branch -a
# 查看 1.33 相关分支
git tag -l '1_33*'
# 
git checkout 1_33_0
```

### 2.2 编译 busybox 

接下来我们配置编译选项，进入到源码根目录运行如下命令进入图形化配置界面：

```bash
make menuconfig
```

勾选 `Settings` —> `Build static binary file (no shared lib)`

> 若是不勾选则需要单独配置 libc，比较麻烦

接下来就是编译了，速度会比编译内核快很多：

```bash
make -j$(nproc)
make install
```

编译完成后会生成一个 `_install` 目录，接下来我们将会用它来构建我们的文件系统

### 2.3 建立文件系统

#### 2.3.1 初始化文件系统

```bash
cd _install
mkdir -pv {bin,sbin,etc,proc,sys,dev,home/ctf,root,tmp,lib64,lib/x86_64-linux-gnu,usr/{bin,sbin}}
touch etc/inittab
mkdir etc/init.d
touch etc/init.d/rcS
chmod +x ./etc/init.d/rcS
```

#### 2.3.2 配置初始化脚本

首先配置 `etc/inttab` ，写入如下内容：

```shell
::sysinit:/etc/init.d/rcS  
::askfirst:/bin/ash  
::ctrlaltdel:/sbin/reboot  
::shutdown:/sbin/swapoff -a  
::shutdown:/bin/umount -a -r  
::restart:/sbin/init
```

在上面的文件中指定了系统初始化脚本，因此接下来配置 `etc/init.d/rcS`，写入如下内容，主要是挂载各种文件系统：

```shell
#!/bin/sh  
mount -t proc none /proc  
mount -t sysfs none /sys  
mount -t devtmpfs devtmpfs /dev  
mount -t tmpfs tmpfs /tmp  
mkdir /dev/pts  
mount -t devpts devpts /dev/pts  
  
echo -e "\nBoot took $(cut -d' ' -f1 /proc/uptime) seconds\n"  
setsid cttyhack setuidgid 1000 sh  
  
poweroff -d 0 -f
```

也可以在根目录下创建 `init` 文件，写入如下内容：

```shell
#!/bin/sh  
chown -R root:root /  
chmod 700 /root  
chown -R ctf:ctf /home/ctf  
  
mount -t proc none /proc  
mount -t sysfs none /sys  
mount -t tmpfs tmpfs /tmp  
mkdir /dev/pts  
mount -t devpts devpts /dev/pts  
  
echo 1 > /proc/sys/kernel/dmesg_restrict  
echo 1 > /proc/sys/kernel/kptr_restrict  
  
echo -e "\nBoot took $(cut -d' ' -f1 /proc/uptime) seconds\n"  
  
cd /home/ctf  
su ctf -c sh  
  
poweroff -d 0 -f
```

别忘了添加可执行权限：

```bash
chmod +x ./init
```
#### 2.3.3 配置用户组

在终端中运行：

```bash
echo "root:x:0:0:root:/root:/bin/sh" > etc/passwd  
echo "ctf:x:1000:1000:ctf:/home/ctf:/bin/sh" >> etc/passwd  
echo "root:x:0:" > etc/group  
echo "ctf:x:1000:" >> etc/group  
echo "none /dev/pts devpts gid=5,mode=620 0 0" > etc/fstab
```

#### 2.3.4 配置 glibc 库

> jump

## 3. 打包文件系统为镜像文件

### 3.1 打包为 cpio 文件

cpio 文件更加常见一些。

把当前目录下所有文件打包到 `../rootfs.cpio` ，总之也可以放到合适的其他位置。

```bash
find . -print0 | cpio --null -ov --format=newc > ../rootfs.cpio
```

## 4. 向文件系统中添加文件

若是我们后续需要向文件系统中补充一些其他的文件，可以选择在原先的 `_install` 文件夹中添加（不过这样的话若是配置多个文件系统则会变得很混乱），也可以解压文件系统镜像后添加文件再重新进行打包

### 4.1 cpio 文件

#### 4.1.1 解压磁盘镜像

```bash
mkdir rootfs
cpio -idv < ./rootfs.cpio
```

#### 4.2.2 重打包磁盘镜像

和打包磁盘镜像的命令一样。

```bash
find . -print0 | cpio --null -ov --format=newc > ../rootfs.cpio
```

## 5. 使用 qemu 运行内核

终于要启动这个内核了。安全起见，我们并不直接在真机上运行这个内核，而是使用 qemu 在虚拟机里运行

### 5.1 配置启动脚本

#### 5.1.1 使用 cpio 文件作为文件系统

首先将先前的`bzImage`和`rootfs.cpio`放到同一个目录下。接下来编写启动脚本。向我们的 `boot.sh` 中写入以下内容

```sh
#!/bin/sh  
qemu-system-x86_64 \  
-m 128M \  
-kernel ./bzImage \  
-initrd ./rootfs.cpio \  
-monitor /dev/null \  
-append "root=/dev/ram rdinit=/sbin/init console=ttyS0 oops=panic panic=1 loglevel=3 quiet kaslr" \  
-cpu kvm64,+smep \  
-smp cores=2,threads=1 \  
-nographic \  
-s
```

分参数说明如下：

- `-m`：虚拟机内存大小
- `-kernel` ：内核镜像路径
- `-initrd` ：初始文件系统路径，cpio 文件系统会被载入到内存当中（initramfs）
- `-monitor` ：将监视器重定向到主机设备 `/dev/null`，这里重定向至 null 主要是防止CTF 中被人通过监视器直接拿 flag
- `-append` ：附加参数选项
  - `kaslr` ：开启内核地址随机化，你也可以改为 `nokaslr` 进行关闭以方便我们进行调试
  - `rdinit` ：指定初始启动进程，这里我们指定了 `/sbin/init` 作为初始进程，其会默认以`/etc/init.d/rcS` 作为启动脚本
  - `loglevel=3` & `quiet` ：不输出log
  - `console=ttyS0` ：指定终端为 `/dev/ttyS0`，这样一启动就能进入终端界面
- `-cpu`：设置CPU选项，在这里开启了smep保护
- `-smp`：设置对称多处理器配置，这里设置了两个核心，每个核心一个线程
- `-nographic`：不提供图形化界面，此时内核仅有串口输出，输出内容会被 QEMU 重定向至我们的终端
- `-s`：相当于`-gdb tcp::1234`的简写（也可以直接这么写），后续我们可以通过gdb连接本地端口进行调试

运行`boot.sh`，成功启动~撒花

但是有个问题，如果添加了 `-monitor /dev/null` 我的 WSL 机器上没有办法通过 `CTRL+A` `X` 退出 qemu 。解决办法也很简单，去掉这一行就可以了。

#### EXTRA. 尝试运行 Copy Fail

> 卡了。不试了。

## 6. 编写可装载内核模块

我们的Linux kernel虽然成功启动了，但是其本身的功能似乎有些单调，那么我们不如自己编写可装载内核模块（Loadable Kernel Modules）来扩充内核的功能吧！

LKM同样是ELF格式文件，但是其不能够独立运行，而只能作为内核的一部分存在

同样的，对于LKM而言，其所处在的内核空间与用户空间是分开的，对于通常有着SMAP/SMEP保护的Linux而言，这意味着**LKM并不能够使用libc中的函数，也不能够直接与用户进行交互**

虽然我们同样能够使用C语言编写LKM，但是作为内核的一部分，LKM编程在一定意义上便是内核编程， 内核版本的每次变化意味着某些函数名也会相应地发生变化，因此LKM编程与内核版本密切相关

### 6.1 简单的测试模块

我们来编写这样一个简单的内核模块，其功能是在载入/卸载时会在内核缓冲区打印字符串：

```c
#include <linux/module.h>
#include <linux/kernel.h>
#include <linux/init.h>

static int __init kernel_module_init(void)
{
    printk("<1>Hello the Linux kernel world!\n");
    return 0;
}

static void __exit kernel_module_exit(void)
{
    printk("<1>Good bye the Linux kernel world! See you again!\n");
}

module_init(kernel_module_init);
module_exit(kernel_module_exit);
MODULE_LICENSE("GPL");
MODULE_AUTHOR("snowcat");
```

#### 头文件

- `linux/module.h` 对于LKM而言这是必须包含的一个头文件
- `linux/kernel.h` 载入内核相关信息
- `linux/init.h` 包含着一些有用的宏

一般情况下这三个头文件对于内核模块编程都是不可或缺的。

#### 入口点 / 出口点

内核模块的初始化函数在编译时通过 `module_init()` 定义，在内核模块被载入时会调用所定义的函数，这里我们将初始化函数设定为 `kernel_module_init`

内核模块的卸载函数在编译时通过 `module_exit()` 定义，在内核模块被卸载时会调用所定义的函数，这里我们将卸载函数定义为 `kernel_module_exit`

#### 其他…

- `__init` 与 `__exit` 宏：用来显式标识内核模块出入口函数
- `MODULE_AUTHOR() & MODULE_LICENSE()`：声明内核作者与发行所用许可证

### 6.2 编译内核模块

与一般的可执行文件所不同的是，我们应当使用 Makefile 来构建一个内核模块，并使用 Kbuild 说明编译规则

首先创建一个 `Kbuild` 文件，写入如下内容：

```Makefile
MODULE_NAME ?= hellokernel  
  
obj-m += $(MODULE_NAME).o  
  
$(MODULE_NAME)-y += main.o
```

简单说明一下这个 Kbuild：

- `MODULE_NAME ?= hellokernel` ：定义了一个局部变量 `MODULE_NAME` ，值为 `hellokernel`
- `obj-m += $(MODULE_NAME).o` ：指定了编译的结果应当为`.ko`文件，即可装载内核模块，同时指定了模块名为 `hellokernel` ，当模块编译时相应的源文件所编译得到的中间文件会先被链接为 `hellokernel.o` ，之后再构建 `.ko` 文件；其他可替代标识为： `obj-y` 编译进内核 ，`obj-n` 不编译
- `$(MODULE_NAME)-y += main.o` ：编译该内核模块所需要的文件，例如这里我们需要 `main.c` ，那么我们就在该变量中添加 `main.o`

接下来创建一个名为 `Makefile` 的文件，写入如下内容，*请将 `/home/username/linux` 换成你的内核仓库的路径* 。

```Makefile
CURRENT_PATH := $(shell pwd)
LINUX_KERNEL_SRC := /home/username/linux

all:
	make -C $(LINUX_KERNEL_SRC) M=$(CURRENT_PATH) modules
clean:
	make -C $(LINUX_KERNEL_SRC) M=$(CURRENT_PATH) clean
```

**注意，这个 Makefile 中的缩进是制表符而不是 4 个空格**

里简单说明一下这个 makefile ：

- `LINUX_KERNEL_SRC := /lib/modules/$(shell uname -r)/build` ：当前系统所使用的内核源码路径
- `make -C $(LINUX_KERNEL_SRC) M=$(CURRENT_PATH) modules`：`-C` 表示进入源码目录进行编译，`M=` 意味着当前正在编译一个外部模块、该变量用以指示外部模块的源码目录， `modules` 则意为进行内核模块编译操作
- `make -C $(LINUX_KERNEL_SRC) M=$(CURRENT_PATH) clean`：同上，不过此时进行的是清理指令

接下来在终端执行 `make` ，我们的内核模块就会自动进行构建。

接下来我们想在 qemu 中测试这个内核模块。把生成的 `hellokernel.ko` 放进文件系统，在 `etc/init.d/rcS` 中添加如下内容并打包。

```shell
insmod /hellokernel.ko
rmmod hellokernel 
```

接下来用新的 cpio 启动内核。执行

```shell
 dmesg | grep "kernel world"
```

能看到一句打印输出，证明内核模块成功加载。

### 6.3 提供应用程式I/O接口


## 参考来源

- [内核简易食用指北](https://arttnba3.cn/2021/02/21/OS-0X01-LINUX-KERNEL-PART-II/)
- 