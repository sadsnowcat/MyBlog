---
title: "Linux kernel 简易指北"
date: 2026-11-24T00:00:00
description: "从编译内核开始学习kernel"
categories:
  - "Kernel"
tags:
  - "kernel"
  - "kernel-build"
  - "kernel-module"
  - "busybox"
  - "qemu"
series:
  - "Linux Kernel"
---


# 00 Linux kernel 入门

> 看了这么久 kernel pwn，还是感觉云里雾里，所以本期我们从编译一个内核开始进行 kernel 学习

## 0. 开始之前

### 环境准备

笔者使用的机器是 wsl + ubuntu 20

需要下载一些编译所需的依赖，以及 qemu，我们将通过 qemu 虚拟机来运行内核

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

这将下载**非常多**的源码，请耐心等待。

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

现在，基于某分支创建一个本地分支，笔者这里选择编译一个 5.11 版本的内核。

```bash
git checkout linux-5.11.y
git branch snowlinux-5.11
git checkout snowlinux-5.11

# 确认结果
git branch
```

再次使用 `make kernelversion` 命令检查版本。我检出的版本是 5.11.22。

### 1.2 配置编译选项

在正式进行内核源码编译之前，我们还需要准备一份编译选项，其包含了内核编译相关的配置，通常存放于源码目录下的 `.config` 文件中。不过我们不需要从零开始手动编写，而是可以通过内核的编译配置系统进行动态生成。

通常情况下，我们在内核源码目录下使用如下命令进入图形化的内核配置面板， **这也是最常用的内核配置方法**，其会读取 `.config` 文件的配置并允许我们在图形化的界面中进行修改，并在该文件不存在时则是会调用 `make defconfig` 先生成一份默认配置：

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

编译时间取决于机器配置，笔者的 WSL2 环境上大概两分钟编完。

### 1.4 可能出现的错误

> 非常幸运的是笔者没有修改默认的编译选项也没有遇到报错，编译顺利。

### 1.5 编译结果

完成后会出现如下信息

```text
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
> > zImage 与 bzImage 都是自解压的压缩内核。bzImage 的 “bz” 是 “big” 的意思，与 bzip2 无关。x86 上现在只用 bzImage，zImage 主要是 ARM 等架构在用。
>
> [https://blog.csdn.net/xiaotengyi2012/article/details/8582886](https://blog.csdn.net/xiaotengyi2012/article/details/8582886)

## 2. 使用 busybox 构建文件系统

> [BusyBox](https://www.busybox.net/) 是一个集成了三百多个最常用 Linux 命令和工具的软件，包含了例如 ls、cat 和 echo 等常见的命令，相比起各大发行版中常用的 [GNU core utilities](https://www.gnu.org/software/coreutils/)，BusyBox 更加的轻量化，且更容易进行配置，因此我们将用 busybox 为我们的内核提供一个基本的用户环境

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

首先配置 `etc/inittab`，写入如下内容：

```text
::sysinit:/etc/init.d/rcS
::askfirst:/bin/ash
::ctrlaltdel:/sbin/reboot
::shutdown:/sbin/swapoff -a
::shutdown:/bin/umount -a -r
::restart:/sbin/init
```

在上面的文件中指定了系统初始化脚本，因此接下来配置 `etc/init.d/rcS`，写入如下内容，主要是挂载各种文件系统：

```bash
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

```bash
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

#### 2.3.4 配置 libc

只需要参考主机把需要的文件放在 `/lib` 和 `/lib64` 下就可以了，主要用到的应该就是 libc 和 ld 这两个了，可以选择创建软链接，但是笔者这里选择了改文件名的方式，这样更方便。%%%%

### 2.4 打包文件系统为镜像文件

#### 2.4.1 打包为 cpio 文件

cpio 文件更加常见一些。

把当前目录下所有文件打包到 `../rootfs.cpio`，总之也可以放到合适的其他位置。

```bash
find . -print0 | cpio --null -ov --format=newc > ../rootfs.cpio
```

### 2.5 向文件系统中添加文件

若是我们后续需要向文件系统中补充一些其他的文件，可以选择在原先的 `_install` 文件夹中添加（不过这样的话若是配置多个文件系统则会变得很混乱），也可以解压文件系统镜像后添加文件再重新进行打包

#### 2.5.1 cpio 文件

##### 解压磁盘镜像

```bash
mkdir rootfs
cd rootfs
cpio -idv < ../rootfs.cpio
```

##### 重打包磁盘镜像

和打包磁盘镜像的命令一样。

```bash
find . -print0 | cpio --null -ov --format=newc > ../rootfs.cpio
```

## 3. 使用 qemu 运行内核

终于要启动这个内核了。安全起见，我们并不直接在真机上运行这个内核，而是使用 qemu 在虚拟机里运行

### 3.1 配置启动脚本

#### 3.1.1 使用 cpio 文件作为文件系统

首先将先前的`bzImage`和`rootfs.cpio`放到同一个目录下。接下来编写启动脚本。向我们的 `boot.sh` 中写入以下内容

```bash
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
- `-kernel`：内核镜像路径
- `-initrd`：初始文件系统路径，cpio 文件系统会被载入到内存当中（initramfs）
- `-monitor`：将监视器重定向到主机设备 `/dev/null`，这里重定向至 null 主要是防止CTF 中被人通过监视器直接拿 flag
- `-append`：附加参数选项
  - `kaslr`：开启内核地址随机化，你也可以改为 `nokaslr` 进行关闭以方便我们进行调试
  - `rdinit`：指定初始启动进程，这里我们指定了 `/sbin/init` 作为初始进程，其会读取 `/etc/inittab` 并执行其中的 `/etc/init.d/rcS`。如果你用的是 2.3.2 里根目录 `init` 那个方案，这里要改成 `rdinit=/init`
  - `loglevel=3` & `quiet`：不输出log
  - `console=ttyS0`：指定终端为 `/dev/ttyS0`，这样一启动就能进入终端界面
- `-cpu`：设置CPU选项，在这里开启了smep保护
- `-smp`：设置对称多处理器配置，这里设置了两个核心，每个核心一个线程
- `-nographic`：不提供图形化界面，此时内核仅有串口输出，输出内容会被 QEMU 重定向至我们的终端
- `-s`：相当于`-gdb tcp::1234`的简写（也可以直接这么写），后续我们可以通过gdb连接本地端口进行调试

运行`boot.sh`，成功启动~撒花

但是有个问题，如果添加了 `-monitor /dev/null` 我的 WSL 机器上没有办法通过 `CTRL+A` `X` 退出 qemu。解决办法也很简单，去掉这一行就可以了。

## 4. 编写可装载内核模块

我们的Linux kernel虽然成功启动了，但是其本身的功能似乎有些单调，那么我们不如自己编写可装载内核模块（Loadable Kernel Modules）来扩充内核的功能吧！

LKM同样是ELF格式文件，但是其不能够独立运行，而只能作为内核的一部分存在

同样的，对于LKM而言，其所处在的内核空间与用户空间是分开的，对于通常有着SMAP/SMEP保护的Linux而言，这意味着**LKM并不能够使用libc中的函数，也不能够直接与用户进行交互**

虽然我们同样能够使用C语言编写LKM，但是作为内核的一部分，LKM编程在一定意义上便是内核编程， 内核版本的每次变化意味着某些函数名也会相应地发生变化，因此LKM编程与内核版本密切相关

### 4.1 简单的测试模块

我们来编写这样一个简单的内核模块，其功能是在载入/卸载时会在内核缓冲区打印字符串：

```c
#include <linux/module.h>
#include <linux/kernel.h>
#include <linux/init.h>

static int __init kernel_module_init(void)
{
    printk(KERN_INFO "Hello the Linux kernel world!\n");
    return 0;
}

static void __exit kernel_module_exit(void)
{
    printk(KERN_INFO "Good bye the Linux kernel world! See you again!\n");
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

### 4.2 编译内核模块

与一般的可执行文件所不同的是，我们应当使用 Makefile 来构建一个内核模块，并使用 Kbuild 说明编译规则

首先创建一个 `Kbuild` 文件，写入如下内容：

```makefile
MODULE_NAME ?= hellokernel

obj-m += $(MODULE_NAME).o

$(MODULE_NAME)-y += main.o
```

简单说明一下这个 Kbuild：

- `MODULE_NAME ?= hellokernel`：定义了一个局部变量 `MODULE_NAME`，值为 `hellokernel`
- `obj-m += $(MODULE_NAME).o`：指定了编译的结果应当为 `.ko` 文件，即可装载内核模块，同时指定了模块名为 `hellokernel`，当模块编译时相应的源文件所编译得到的中间文件会先被链接为 `hellokernel.o`，之后再构建 `.ko` 文件；其他可替代标识为： `obj-y` 编译进内核，`obj-n` 不编译
- `$(MODULE_NAME)-y += main.o`：编译该内核模块所需要的文件，例如这里我们需要 `main.c`，那么我们就在该变量中添加 `main.o`

接下来创建一个名为 `Makefile` 的文件，写入如下内容，*请将  `/home/username/linux` 换成你的内核仓库的路径*。

```makefile
CURRENT_PATH := $(shell pwd)
LINUX_KERNEL_SRC := /home/username/linux

all:
	make -C $(LINUX_KERNEL_SRC) M=$(CURRENT_PATH) modules
clean:
	make -C $(LINUX_KERNEL_SRC) M=$(CURRENT_PATH) clean
```

**注意，这个 Makefile 中的缩进是制表符而不是 4 个空格**

这里简单说明一下这个 makefile：

- `LINUX_KERNEL_SRC := /home/username/linux`：当前系统所使用的内核源码路径
- `make -C $(LINUX_KERNEL_SRC) M=$(CURRENT_PATH) modules`：`-C` 表示进入源码目录进行编译，`M=` 意味着当前正在编译一个外部模块、该变量用以指示外部模块的源码目录， `modules` 则意为进行内核模块编译操作
- `make -C $(LINUX_KERNEL_SRC) M=$(CURRENT_PATH) clean`：同上，不过此时进行的是清理指令

接下来在终端执行 `make`，我们的内核模块就会自动进行构建。

接下来我们想在 qemu 中测试这个内核模块。把生成的 `hellokernel.ko` 放进文件系统，在 `etc/init.d/rcS` 中添加如下内容并打包。

```bash
insmod /hellokernel.ko
rmmod hellokernel
```

接下来用新的 cpio 启动内核。执行

```bash
dmesg | grep "kernel world"
```

能看到一句打印输出，证明内核模块成功加载。

### 4.3 提供应用程式I/O接口

#### 4.3.1 设备注册

Linux 的设计哲学之一便是**万物皆文件**。**一切都可以被抽象为文件，一切都可以使用访问文件的方式进行操作**，这提供了高层次上的操作一致性。

同样地，我们若是想要能够与我们的内核模块进行交互，则同样可以通过文件进行——注册一个“虚拟设备节点”，随后我们的用户态程序便可以使用系统调用`read、write、ioctl`来完成与内核模块间的通信。

##### 设备分类

在 Linux 中 I/O 设备分为如下两类：

- **字符设备**：在 I/O 传输过程中**以字符为单位**进行传输的设备，例如键盘、串口等。字符设备按照字符流的方式被有序访问，不能够进行随机读取。
- **块设备**：在块设备中，信息被存储在固定大小的块中，每个块有着自己的地址，例如硬盘、SD卡等。用户可以对块设备进行**随机访问——从任意位置读取一定长度的数据**

##### file_operations 结构体

在注册设备之前，我们需要用到一个结构体——`file_operations`来完成对设备的一些相关定义，该结构体定义于`include/linux/fs.h`中，相关源码比较长不在此贴出，在其中定义了大量的函数指针。

> arttnba3's 认为作用类似于OOP中的**接口类**，或者是虚函数表

一个文件应当拥有一个`file_operations实例`，并指定相关系统调用函数指针所指向的自定义函数，在后续进行设备的注册时会使用该结构体

##### 主设备号&次设备号

在 Linux 内核中，使用类型 `dev_t`（`__u32`）来标识一个设备的设备号。一个设备号由主设备号和次设备号组成，高 12 位存储主设备号，低 20 位存储次设备号：

- **主设备号**：标识设备类型，使用宏 `MAJOR(dev_t dev)` 可以获取主设备号。
- **次设备号**：用以区分同类型设备，使用宏`MINOR(dev_t dev)`可以获取次设备号。

Linux还提供了一个宏 `MKDEV(int major, int minor)`，用以通过主次设备号生成对应的设备号。

##### 设备节点

Linux中所有的设备都以文件的形式进行访问，这些文件存放在`/dev`目录下，一个文件就是一个**设备节点**。在Linux kernel中使用结构体`device`描述一个设备，该结构体定义于`include/linux/device.h`（内核源码路径）中，**每个设备在内核中都有着其对应的device实例，其中记录着设备的相关信息**。在DTS（Device Tree Source，设备树）中则使用`device_node`结构体表示一个设备。

##### 设备类

在Linux kernel中使用结构体`class`用以表示**高层次抽象的设备**，该结构体定义于`include/linux/device/class.h`中。每个设备节点实例中都应当包含着一个指向相应设备类实例的指针

##### 设备的注册与注销

我们接下来先注册一个字符型设备，大致的一个步骤如下：

- 使用由内核提供的函数`register_chrdev(unsigned int major, const char *name, const struct file_operations *fops)`进行字符型设备注册，该函数定义于`include/linux/fs.h`，会将注册成功后的主设备号返回，若失败则会返回一个负值，参数说明如下：
  - major：主设备号，若为0则由内核分配主设备号
  - name：设备名，由用户指定
  - fops：该设备的文件操作系统（file_operations结构体）指针
- 使用宏`class_create(owner, name)`创建**设备类**，该宏定义于`include/linux/device.h`中，其核心调用函数是`__class_create(struct module *owner, const char *name, struct lock_class_key *key)`
- 使用函数`device_create(struct class *cls, struct device *parent, dev_t devt, void *drvdata, const char *fmt, ...)`**创建设备节点**，若成功则最终会在`/dev`目录下生成我们的设备节点文件，各参数说明如下：
  - cls：该设备的设备类
  - parent：该设备的父设备节点，通常情况下应当为某种总线或主机控制器，若该设备为顶级设备则设为NULL
  - devt：该设备的设备号
  - drvdata：该驱动的相关信息，若无则填NULL
  - fmt：设备名称

设备的注销则是逆着上面的进程进行，同样有着相对应的三个函数：`device_destroy(struct class *cls, dev_t devt)`、`class_destroy(struct class *cls)`、`unregister_chrdev(unsigned int major, const char *name)`，用法相似，这里就不一一赘叙了。

**注意，若是注册设备的进程中的某一步出错了，我们在退出内核态函数之前应当手动调用注销函数清理原先的相关资源**

##### 设备权限

内核模块运行在内核空间，所创建的设备节点只有root用户才有权限进行读写，对于其他用户而言便毫无意义，这并不是我们想要的，因此我们需要通过进一步的设置使得所有用户都有权限通过设备节点文件与我们的内核模块进行交互。

在内核中使用`inode`结构体表示一个文件，该结构体定义于`include/linux/fs.h`中，其中用以标识权限的是成员`i_mode`。

而在内核中对于使用`filp_open()`打开的文件，Linux内核中使用 `file` 结构体进行描述，该结构体定义于`include/linux/fs.h`中，其中有着指向内核中该文件的 inode 实例的指针，使用`file_inode()`函数可以获得一个 file 结构体中的 inode 结构体指针。

那么我们不难想到，若是在内核模块中使用`filp_open()`函数打开我们的设备节点文件，随后修改 file 结构体中的 inode 指针指向的 inode 实例的 i_mode 成员，便能够修改该文件的权限。

> 需要注意的是rwx三个权限位仅占3位，因而应当使用八进制进行操作：`__inode->i_mode |= 0666;`，而不是16进制

最终的代码如下：

```c
#include <linux/module.h>
#include <linux/kernel.h>
#include <linux/init.h>
#include <linux/fs.h>
#include <linux/device.h>

#define DEVICE_NAME "scdevice"
#define DEVICE_PATH "/dev/scdevice"
#define CLASS_NAME "scmodule"

static int major_num;
static struct  class * module_class = NULL;
static struct device * module_device = NULL;
static struct file * __file = NULL;
struct inode * __inode = NULL;

static struct file_operations sc_module_fo = {
    .owner = THIS_MODULE
};

static int __init kernel_module_init(void){
    printk(KERN_INFO "[snowcat_TestModule:] Module loaded. Start to register device...\n" );
    major_num = register_chrdev(0,DEVICE_NAME,&sc_module_fo);
    if (major_num < 0 ){
        return major_num;
    }

    module_class = class_create(THIS_MODULE, CLASS_NAME);
    if (IS_ERR(module_class))
    {
        unregister_chrdev(major_num, DEVICE_NAME);
        printk(KERN_INFO "[snowcat_TestModule:] Failed to register class device!\n");
        return PTR_ERR(module_class);
    }
    printk(KERN_INFO "[snowcat_TestModule:] Class device register complete.\n");

    module_device = device_create(module_class, NULL, MKDEV(major_num, 0), NULL, DEVICE_NAME);
    if (IS_ERR(module_device))
    {
        class_destroy(module_class);
        unregister_chrdev(major_num, DEVICE_NAME);
        printk(KERN_INFO "[snowcat_TestModule:] Failed to create the device!\n");
        return PTR_ERR(module_device);
    }
    printk(KERN_INFO "[snowcat_TestModule:] Module register complete.\n");

    __file = filp_open(DEVICE_PATH, O_RDONLY, 0);
    if (IS_ERR(__file))
    {
        device_destroy(module_class, MKDEV(major_num, 0));
        class_destroy(module_class);
        unregister_chrdev(major_num, DEVICE_NAME);
        printk(KERN_INFO "[snowcat_TestModule:] Unable to change module privilege!\n");
        return PTR_ERR(__file);
    }
    __inode = file_inode(__file);
    __inode->i_mode |= 0666;
    filp_close(__file, NULL);
    printk(KERN_INFO "[snowcat_TestModule:] Module privilege change complete.\n");

    return 0;
}

static void __exit kernel_module_exit(void)
{
    printk(KERN_INFO "[snowcat_TestModule:] Start to clean up the module.\n");
    device_destroy(module_class, MKDEV(major_num, 0));
    class_destroy(module_class);
    unregister_chrdev(major_num, DEVICE_NAME);
    printk(KERN_INFO "[snowcat_TestModule:] Module clean up complete. See you next time.\n");
}

module_init(kernel_module_init);
module_exit(kernel_module_exit);
MODULE_LICENSE("GPL");
MODULE_AUTHOR("snowcat");
```

> > 在这里我们用到了一个函数`IS_ERR()`，定义于`include/linux/err.h`中，其核心为宏`IS_ERR_VALUE()`，即对于内核中的一些操作（如创建设备节点等）若是失败，则通常会返回一个错误指针，其值落在 `-4095` 到 `-1` 之间（也就是 `(unsigned long)ptr >= (unsigned long)-4095`），该函数用以判断指针是否为错误值

编译，测试，我们的内核模块成功地注册了一个设备并成功注册到了`/dev`目录下。

接下来我们只要为内核模块编写相应的API，便可以在用户态应用程式上通过虚拟设备`/dev/scdevice`完成与内核模块间的通信。

#### 4.3.2 编写系统调用接口函数

我们编写如下的五个简单的函数使得用户应用程式可以通过`open、close、read、write、ioctl`与其进行交互

在这里我们引入了自旋锁`spinlock_t`类型变量以增加对多线程的支持

需要注意的是file_operations结构体中ioctl的函数指针应当为`unlocked_ioctl`，close对应的函数指针应当为`release`

✳ 以及**内核空间与用户空间之间传递数据应当使用** `copy_from_user(void *to, const void __user *from, unsigned long n)` 和 `copy_to_user(void __user *to, const void *from, unsigned long n)` 函数

> 模块大了起来，于是选择封装成一个头文件。

```c
/*
.h
refer to arttnba3
*/

#include <linux/module.h>
#include <linux/kernel.h>
#include <linux/init.h>
#include <linux/fs.h>
#include <linux/device.h>

#define DEVICE_NAME "scdevice"
#define CLASS_NAME "scmodule"
#define NOT_INIT 0xffffffff
#define READ_ONLY 0x1000
#define ALLOW_WRITE 0x1001
#define BUFFER_RESET 0x1002

static int major_num;
static int sc_module_mode = READ_ONLY;
static struct class* module_class = NULL;
static struct device* module_device = NULL;
static void * buffer = NULL;
static spinlock_t spin;

static int __init kernel_module_init(void);
static void __exit kernel_module_exit(void);
static int sc_module_open(struct inode *, struct file *);
static ssize_t sc_module_read(struct file *, char __user *, size_t, loff_t *);
static ssize_t sc_module_write(struct file* ,const char __user *,size_t,loff_t *);
static int sc_module_release(struct inode* ,struct file *);
static long sc_module_ioctl(struct file *, unsigned int, unsigned long);
static long __internal_sc_module_ioctl(struct file * __file, unsigned int cmd, unsigned long param);

static struct file_operations sc_module_fo = {
    .owner = THIS_MODULE,
    .unlocked_ioctl = sc_module_ioctl,
    .open = sc_module_open,
    .read = sc_module_read,
    .write = sc_module_write,
    .release = sc_module_release,
};

```

```c
// main.c ; refer to arttnba3
#include <linux/module.h>
#include <linux/kernel.h>
#include <linux/init.h>
#include <linux/fs.h>
#include <linux/device.h>
#include <linux/slab.h>
#include <linux/uaccess.h>
#include "scmodule.h"

module_init(kernel_module_init);
module_exit(kernel_module_exit);
MODULE_LICENSE("GPL");
MODULE_AUTHOR("snowcat");

static int __init kernel_module_init(void){
    spin_lock_init(&spin);
    printk(KERN_INFO "[snowcat_TestModule:] Module loaded.");
    major_num = register_chrdev(0,DEVICE_NAME,&sc_module_fo);
    if(major_num<0){
        // printk();
        return major_num;
    }
    // printk()

    module_class = class_create(THIS_MODULE,CLASS_NAME);
    if(IS_ERR(module_class)){
        unregister_chrdev(major_num,DEVICE_NAME);
        // printk()
        return PTR_ERR(module_class);
    }
    // printl(KERN_INFO)

    module_device = device_create(module_class,NULL,MKDEV(major_num,0),NULL,DEVICE_NAME);
    if(IS_ERR(module_device)){
        class_destroy(module_class);
        unregister_chrdev(major_num ,DEVICE_NAME);
        return PTR_ERR(module_device);
    }

    return 0;
}

static void __exit kernel_module_exit(void){
    printk(KERN_INFO "[snowcat_TestModule:] Start to clean up module.\n");

    device_destroy(module_class, MKDEV(major_num, 0));
    class_destroy(module_class);
    unregister_chrdev(major_num, DEVICE_NAME);
    printk(KERN_INFO "[snowcat_TestModule:] Module clean up complete.\n");
}

static long sc_module_ioctl(struct file * __file,unsigned int cmd,unsigned long param){
    long ret;
    spin_lock(&spin);
    ret = __internal_sc_module_ioctl(__file,cmd,param);
    spin_unlock(&spin);
    return ret;
}

static long __internal_sc_module_ioctl(struct file * __file,unsigned int cmd,unsigned long param ){
    // printk();
    switch (cmd)
    {
    case READ_ONLY:
        if (!buffer){
            printk(KERN_INFO "[snowcat_TestModule:] Please reset the buffer at first!\n");
            return -1;
        }
        printk(KERN_INFO "[snowcat_TestModule:] Module operation mode reset to READ_ONLY.\n");
        sc_module_mode = READ_ONLY;
        break;
    case ALLOW_WRITE:
        if (!buffer)
        {
            printk(KERN_INFO "[snowcat_TestModule:] Please reset the buffer at first!\n");
            return -1;
        }
        printk(KERN_INFO "[snowcat_TestModule:] Module operation mode reset to ALLOW_WRITE.\n");
        sc_module_mode = ALLOW_WRITE;
        break;
    case BUFFER_RESET:
        if (!buffer)
        {
            buffer = kmalloc(0x500, GFP_ATOMIC);
            if (buffer == NULL)
            {
                printk(KERN_INFO "[snowcat_TestModule:] Unable to initialize the buffer. Kernel malloc error.\n");
                sc_module_mode = NOT_INIT;
                return -1;
            }
        }
        printk(KERN_INFO "[snowcat_TestModule:] Buffer reset. Module operation mode reset to READ_ONLY.\n");
        memset(buffer, 0, 0x500);
        sc_module_mode = READ_ONLY;
        break;
    case NOT_INIT:
        printk(KERN_INFO "[snowcat_TestModule:] Module operation mode reset to NOT_INIT.\n");
        sc_module_mode = NOT_INIT;
        kfree(buffer);
        buffer = NULL;
        return 0;
    default:
        printk(KERN_INFO "[snowcat_TestModule:] Invalid operation code.\n");
        return -1;
    }
    return 0;
}

static int sc_module_open(struct inode * __inode, struct file * __file){
    spin_lock(&spin);

    if (buffer == NULL)
    {
        buffer = kmalloc(0x500, GFP_ATOMIC);
        if (buffer == NULL)
        {
            printk(KERN_INFO "[snowcat_TestModule:] Unable to initialize the buffer. Kernel malloc error.\n");
            sc_module_mode = NOT_INIT;
            spin_unlock(&spin);
            return -1;
        }
        memset(buffer, 0, 0x500);
        sc_module_mode = READ_ONLY;
        printk(KERN_INFO "[snowcat_TestModule:] Device open, buffer initialized successfully.\n");
    }
    else
    {
        printk(KERN_INFO "[snowcat_TestModule:] Warning: reopen the device may cause unexpected error in kernel.\n");
    }

    spin_unlock(&spin);

    return 0;
}

static int sc_module_release(struct inode * __inode, struct file * __file)
{
    spin_lock(&spin);

    if (buffer){
        kfree(buffer);
        buffer = NULL;
    }
    printk(KERN_INFO "[snowcat_TestModule:] Device closed.\n");
    spin_unlock(&spin);
    return 0;
}

static ssize_t sc_module_read(struct file * __file, char __user * user_buf, size_t size, loff_t * __loff)
{
    const char * const buf = (char*)buffer;
    int len = size > 0x500 ? 0x500 : size;
    int count;

    spin_lock(&spin);

    if (sc_module_mode == NOT_INIT){
        printk(KERN_INFO "[snowcat_TestModule:] Buffer not initialized yet.\n");
        spin_unlock(&spin);
        return -1;
    }

    count = copy_to_user(user_buf, buf, len);
    spin_unlock(&spin);
    return count ? -EFAULT : len;
}

static ssize_t sc_module_write(struct file * __file, const char __user * user_buf, size_t size, loff_t * __loff)
{
    char * const buf = (char*)buffer;
    int len = size > 0x500 ? 0x500 : size;
    int count;
    spin_lock(&spin);
    if (sc_module_mode == NOT_INIT){
        printk(KERN_INFO "[snowcat_TestModule:] Buffer not initialized yet.\n");
        count = -1;
    }else if(sc_module_mode == READ_ONLY){
        printk(KERN_INFO "[snowcat_TestModule:] Unable to write under mode READ_ONLY.\n");
        count = -1;
    }else
        count = copy_from_user(buf, user_buf, len);

    spin_unlock(&spin);
    return count < 0 ? count : (count ? -EFAULT : len);
}
```

#### 4.3.3 测试模块接口

我们编写如下程序来测试我们的接口是否正常：

```c
#include <unistd.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <fcntl.h>
#include <sys/ioctl.h>

char * buf = "test for read and write.\n";

int main(void){
    char ch[0x100];
    int fd = open("/dev/scdevice", O_RDWR);
    if (fd < 0) {
        perror("open /dev/scdevice");
        return 1;
    }
    int len = strlen(buf);
    ioctl(fd, 0x1000, NULL);
    write(fd, buf, len);
    ioctl(fd, 0x1001, NULL);
    write(fd, buf, len);
    read(fd, ch, len);
    write(0, ch, len);
    ioctl(fd, 0x1002, NULL);
    read(fd, ch, len);
    write(0, ch, len);
    close(fd);
    return 0;
}
```

在 qemu 中运行程序并用 `dmesg` 查看日志信息。

#### 4.3.4 procfs接口

除了创建虚拟设备节点供通信以外，我们也可以选择创建虚拟文件节点的方式与用户进程间进行通信。*笔者的第一次 kernel pwn 就是挂载到 proc/ 下的一个文件*。

##### procfs：进程文件系统

procfs 即**进程文件系统**（ Process file system ），其中包含一个**伪文件系统**，在系统启动时动态生成文件，不会占用真正的储存空间，而是占用一定的内存。 procfs 用以通过内核访问进程信息，通常被挂载到 `/proc` 目录下。

##### proc_ops 结构体

**`proc_ops`** 结构体在 5.6 版本后才被引入，用于替代原本在 `/proc` 文件系统中使用的 `struct file_operations`，目的是让接口更精简。如果你查看 5.6 及之后版本的内核源码，它定义在 **`include/linux/proc_fs.h`** 头文件中。类似于`file_operations`结构体。

仅定义了少量函数指针成员，这里不再展示。需要注意的是其中的 `proc_ioctl` 成员是 5.11 才加进来的，用 5.10 及更早的内核时 `proc_ops` 里没有这个字段。

##### 创建虚拟文件夹

使用 `proc_mkdir(const char *, struct proc_dir_entry *)` 函数可以快速创建虚拟文件夹，第一个参数用以指定文件夹名，第二个参数用以指定该文件夹挂载于哪个procfs节点下，若为NULL则自动挂载到 `/proc` 目录下

该函数的返回值为`proc_dir_entry`类型的指针，该结构体定义于 `fs/proc/internal.h` 中，我们可以通过这个结构体指针管理我们的虚拟文件。

##### 创建虚拟文件节点

使用`proc_create(const char *name, umode_t mode, struct proc_dir_entry *parent, const struct proc_ops *proc_ops)`函数可以快速创建一个文件节点

- `name`：文件名
- `mode`：文件读写执行权限
- `parent`：该文件挂载的procfs节点，若为NULL则自动挂载到`/proc`目录下
- `proc_ops`：该文件的proc_ops结构体

该函数的返回值同样为`proc_dir_entry`类型的指针

##### 注销虚拟文件节点

函数 `remove_proc_entry(const char *, struct proc_dir_entry *)` 用以注销此前创建的文件，其中第一个参数为文件名，第二个参数为其挂载的节点，若为NULL则默认为 `/proc` 目录。

##### 测试模块接口

我们此前的模块代码只需稍加修改即可适用于procfs，这里只贴出修改后的部分。这里笔者没有单独拿出一个头文件。

```c
#include <linux/module.h>
#include <linux/kernel.h>
#include <linux/init.h>
#include <linux/fs.h>
#include <linux/proc_fs.h>
#include <linux/slab.h>
#include <linux/uaccess.h>

#define PROC_NAME "scproc"
#define CLASS_NAME "scmodule"
#define NOT_INIT 0xffffffff
#define READ_ONLY 0x1000
#define ALLOW_WRITE 0x1001
#define BUFFER_RESET 0x1002

static int module_mode = READ_ONLY;
static struct proc_dir_entry* module_proc = NULL;
static void * buffer = NULL;
static spinlock_t spin;

static int __init kernel_module_init(void);
static void __exit kernel_module_exit(void);
static int module_open(struct inode* ,struct file *);
static ssize_t module_read(struct file* ,char __user *,size_t,loff_t * );
static ssize_t module_write(struct file* ,const char __user * ,size_t,loff_t* );
static int module_release(struct inode* ,struct file * );
static long module_ioctl(struct file* ,unsigned int ,unsigned long);
static long __internal_module_ioctl(struct file * __file,unsigned int cmd,unsigned long param);

module_init(kernel_module_init);
module_exit(kernel_module_exit);
MODULE_LICENSE("GPL");
MODULE_AUTHOR("snowcat");

static struct proc_ops module_fo = {
    .proc_ioctl = module_ioctl,
    .proc_open = module_open,
    .proc_read = module_read,
    .proc_write = module_write,
    .proc_release = module_release,
};

static int __init kernel_module_init(void){
    spin_lock_init(&spin);
    printk(KERN_INFO "[TestModule] Module loaded.\n");

    module_proc = proc_create(PROC_NAME,0666,NULL,&module_fo);

    return 0;
}

static void __exit kernel_module_exit(void){
    printk(KERN_INFO "[TestModule] Start to clean up module.\n");
    remove_proc_entry(PROC_NAME,NULL);
    printk(KERN_INFO "[TestModule] Module clean up complete.\n");
    return ;
}

static long __internal_module_ioctl(struct file * __file,unsigned int cmd,unsigned long param){
    printk(KERN_INFO "[TestModule] Received operation code: %d\n",cmd);

    switch (cmd)
    {
    case READ_ONLY:
        if(!buffer){
            printk(KERN_INFO "[TestModule] Please reset the buffer at first.\n");
            return -1;
        }
        printk(KERN_INFO "[TestModule] Module operation mode reset to READ_ONLY.\n");
        module_mode = READ_ONLY;
        break;
    case ALLOW_WRITE:
        if (!buffer)
        {
            printk(KERN_INFO "[TestModule] Please reset the buffer at first!\n");
            return -1;
        }
        printk(KERN_INFO "[TestModule] Module operation mode reset to ALLOW_WRITE.\n");
        module_mode = ALLOW_WRITE;
        break;
    case BUFFER_RESET:
        if (!buffer)
        {
            buffer = kmalloc(0x500, GFP_ATOMIC);
            if (buffer == NULL)
            {
                printk(KERN_INFO "[TestModule] Unable to initialize the buffer. Kernel malloc error.\n");
                module_mode = NOT_INIT;
                return -1;
            }
        }
        printk(KERN_INFO "[TestModule] Buffer reset. Module operation mode reset to READ_ONLY.\n");
        memset(buffer, 0, 0x500);
        module_mode = READ_ONLY;
        break;
    case NOT_INIT:
        printk(KERN_INFO "[TestModule] Module operation mode reset to NOT_INIT.\n");
        module_mode = NOT_INIT;
        kfree(buffer);
        buffer = NULL;
        return 0;
    default:
        printk(KERN_INFO "[TestModule] Invalid operation code.\n");
        return -1;
    }
    return 0;
}

static long module_ioctl(struct file * __file, unsigned int cmd, unsigned long param){
    long ret;
    spin_lock(&spin);
    ret = __internal_module_ioctl(__file, cmd, param);
    spin_unlock(&spin);
    return ret;
}

static int module_open(struct inode * __inode, struct file * __file){
    spin_lock(&spin);

    if (buffer == NULL) {
        buffer = kmalloc(0x500, GFP_ATOMIC);
        if (buffer == NULL)
        {
            printk(KERN_INFO "[TestModule] Unable to initialize the buffer. Kernel malloc error.\n");
            module_mode = NOT_INIT;
            spin_unlock(&spin);
            return -1;
        }
        memset(buffer, 0, 0x500);
        module_mode = READ_ONLY;
        printk(KERN_INFO "[TestModule] Device open, buffer initialized successfully.\n");
    } else {
        printk(KERN_INFO "[TestModule] Warning: reopen the device may cause unexpected error in kernel.\n");
    }
    spin_unlock(&spin);
    return 0;
}

static int module_release(struct inode * __inode, struct file * __file)
{
    spin_lock(&spin);

    if (buffer)
    {
        kfree(buffer);
        buffer = NULL;
    }
    printk(KERN_INFO "[TestModule] Device closed.\n");
    spin_unlock(&spin);
    return 0;
}

static ssize_t module_read(struct file * __file, char __user * user_buf, size_t size, loff_t * __loff)
{
    const char * const buf = (char*)buffer;
    int len = size > 0x500 ? 0x500 : size;
    int count;

    spin_lock(&spin);

    if (module_mode == NOT_INIT)
    {
        printk(KERN_INFO "[TestModule] Buffer not initialized yet.\n");
        spin_unlock(&spin);
        return -1;
    }

    count = copy_to_user(user_buf, buf, len);

    spin_unlock(&spin);

    return count ? -EFAULT : len;
}

static ssize_t module_write(struct file * __file, const char __user * user_buf, size_t size, loff_t * __loff)
{
    char * const buf = (char*)buffer;
    int len = size > 0x500 ? 0x500 : size;
    int count;

    spin_lock(&spin);

    if (module_mode == NOT_INIT)
    {
        printk(KERN_INFO "[TestModule] Buffer not initialized yet.\n");
        count = -1;
    }
    else if(module_mode == READ_ONLY)
    {
        printk(KERN_INFO "[TestModule] Unable to write under mode READ_ONLY.\n");
        count = -1;
    }
    else
        count = copy_from_user(buf, user_buf, len);

    spin_unlock(&spin);
    return count < 0 ? count : (count ? -EFAULT : len);
}
```

编译好模块后，你可以用 IDA 逆向一下编译出来的模块，如果做过 kernel pwn 入门题目的逆向，相信你很快就能明白内核模块的编译和加载是怎么回事了。

我们使用如下程序进行测试：

```c
#include <unistd.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <fcntl.h>
#include <sys/ioctl.h>

char * buf = "test for read and write.\n";

int main(void)
{
    char ch[0x100];
    memset(ch, 0, sizeof(ch));
    int fd = open("/proc/scproc", O_RDWR);
    if (fd < 0) {
        perror("open /proc/scproc");
        return 1;
    }
    int len = strlen(buf);
    ioctl(fd, 0x1000, NULL);

    write(fd, buf, len);

    ioctl(fd, 0x1001, NULL);
    write(fd, buf, len);
    read(fd, ch, len);
    write(0, ch, len);

    ioctl(fd, 0x1002, NULL);
    read(fd, ch, len);
    write(0, ch, len);

    close(fd);
    return 0;
}
```

再次重新打包一下，记得在 `etc/init.d/rcS` 中装载模块，运行测试。

## 5. 使用 qemu + gdb 调试Linux内核

调试的时候最好修改 `etc/inittab` 或 `etc/init.d/rcS`（用根目录 `init` 那套方案的话就改 `init`），让我们运行内核后的权限是 root，这样可以方便地打断点。

### 5.1 载入内核符号表

直接使用 gdb 载入之前在源码根目录下编译出来的未压缩内核镜像 vmlinux 即可。

```bash
gdb ./vmlinux
```

启动脚本里的 `kaslr` 记得换成 `nokaslr`。KASLR 开着的话每次启动内核基址都重新随机，gdb 里 vmlinux 的符号地址和实际跑的对不上，断点会打不中。

### 5.2 remote连接

我们启动时已经将内核映射到了本地的1234端口，只需要gdb连接上就行。

```bash
target remote:1234
```

### 5.3 解压 bzImage 镜像

有的时候我们只有压缩后的内核镜像`bzImage`（例如在一些 CTF 题目中），此时我们可以使用 `extract-vmlinux` 进行解压。

这里不再展示 `extract-vmlinux` 的源码。这个脚本不用另外下载，linux 源码仓库里就有，路径是 `scripts/extract-vmlinux`。

### 5.4 寻找gadget

用ROPgadget或者ropper都行，笔者比较喜欢使用ROPgadget

```bash
ROPgadget --binary ./vmlinux > gadget.txt
```

一般出来大概有个几十MB

### 5.5 调试内核模块

使用 gdb 调试内核模块和调试普通的可执行文件大致上是相同的，不过我们需要额外指定各个需要被我们调试的 section 的载入地址

首先通过读取 `/sys/module/模块名/sections/` 目录下对应的文件获取对应 section 在内核中的载入地址，例如我们调试时需要用到 `.text`、`.data`、`.bss` 这三个段的数据：

```bash
cat /sys/module/scdevice/sections/.text
cat /sys/module/scdevice/sections/.data
cat /sys/module/scdevice/sections/.bss
```

之后在使用 gdb 连接上 qemu 后，使用 `add-symbol-file` 命令载入内核模块的符号，第一个地址对应 `.text` 段，其余段用 `-s` 逐个指定：

```bash
add-symbol-file scdevice.ko 0xffffffffc0000000 -s .data 0xffffffffc0002000 -s .bss 0xffffffffc0004000
```

地址换成上面 `cat` 出来的实际值，之后就可以正常调试内核模块了。

## 参考来源

- [arttnba3's blog - 内核简易食用指北](https://arttnba3.cn/2021/02/21/OS-0X01-LINUX-KERNEL-PART-II/)
- [bootlin 小课堂](https://bootlin.com/doc/training/embedded-linux/)
- [snowcat's blog - IoT学习笔记](https://www.sadsnowcat.com/posts/iot/iot-03)
