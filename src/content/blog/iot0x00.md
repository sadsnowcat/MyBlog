---
title: "IoT 学习笔记 0x00"
description: "先来了解了解嵌入式吧"
date: "2026-08-27T12:04:36.644Z"
draft: false
sticky: false
showHeroImage: false
tags: [IoT]
categories: [IoT]
series: [IoT Learning]
comments: true
sidebar:
  enable: true
  toc: true
  relatedPosts: true
---

# IoT 学习笔记 0x00

> 对 IoT 有一些兴趣，先来了解了解嵌入式吧
>
> 本系列大部分为文档的翻译。

参考资料： [嵌入式 Linux 与内核工程](https://bootlin.com/doc/training/embedded-linux/)

## 准备培训

### 安装实验数据

请在终端中下载并解压其 tar 包：

```bash
cd
wget https://bootlin.com/doc/training/embedded-linux/embedded-linux-qemu-labs.tar.xz
tar xvf embedded-linux-qemu-labs.tar.xz
```

实验数据现已位于主目录下的 `embedded-linux-qemu-labs` 目录中。该目录包含各项实践实验所使用的目录与文件。它还将用作工作空间，特别是在需要时将生成的文件分开保存。

### 更新发行版

为避免在实践实验中安装软件包时出现任何问题，可对发行版中的软件包应用最新的更新。

```bash
sudo apt update
sudo apt dist-upgrade
```

## 构建交叉编译工具链

进入 $HOME/embedded-linux-qemu-labs/toolchain 目录。

本实验需要一台至少配备 4 GB 内存的系统或虚拟机。

### 安装所需软件包

执行以下命令：

```bash
sudo apt install build-essential git autoconf bison flex texinfo help2man gawk libtool-bin \
libncurses5-dev unzip gettext python3 rsync
```

### 获取 Crosstool-ng

我们通过 Crosstool-ng 的 git 源码仓库下载其源代码，并切换到我们已测试过的一个 commit：

```bash
git clone https://github.com/crosstool-ng/crosstool-ng
cd crosstool-ng/
git checkout crosstool-ng-1.28.0
```

### 构建并安装 Crosstool-ng

由于我们不是从发布版归档构建 Crosstool-ng，而是从 git 仓库构建，因此首先需要生成一个 configure 脚本，更一般地说，要生成发布版源码归档中所附带的所有生成文件：

```bash
./bootstrap
```

然后，我们既可以把 Crosstool-ng 全局安装到系统上，也可以让它保留在下载目录中本地使用。我们选择后一种方案。如 https://crosstool-ng.github.io/docs/install/#hackers-way 文档所述，执行：

```bash
./configure --enable-local
make
```

随后，你可以通过运行以下命令获取 Crosstool-ng 的帮助：

```bash
./ct-ng help
```

### 配置要生成的工具链

单独一份 Crosstool-ng 安装即可按需生成任意数量的工具链，可用于不同架构、不同 C 库以及各组件的不同版本。

Crosstool-ng 自带一组针对各种典型配置的预制配置文件：Crosstool-ng 称之为样例（samples）。可通过 `./ct-ng list-samples` 命令列出它们。

我们将加载 Cortex A9 样例。使用 `./ct-ng` 命令加载它。

```bash
# 选择你实际看到的 Cortex A9 样例
./ct-ng arm-cortexa9_neon-linux-gnueabihf
```

在 menuconfig 中进行一些微调

```bash
./ct-ng menuconfig
```

- 在 **Path and misc options** 中：

  - 启用 **Try features marked as EXPERIMENTAL**

- 在 **Toolchain options** 中：

  - 将 **Tuple's vendor string (TARGET_VENDOR)** 设置为 `training`。
  - 将 **Tuple's alias (TARGET_ALIAS)** 设置为 `arm-linux`。这样，我们就能用 `arm-linux-gcc` 调用编译器，它比基于完整工具链元组（tuple）的名称更简短。

- 在 **Operating System** 中：

  - 将 **Version of linux** 设置为最接近但略旧于 6.1 的版本。重要的是，工具链中使用的内核头文件版本不应新于目标板上运行的内核（v6.1）。

- 在 **C-library** 中：

  - 如果尚未设置，将 **C library** 设置为 musl (`LIBC_MUSL`)

- 在 **C compiler** 中：

  - 将 **Version of gcc** 设置为 15.2.0。
  - 确保 **C++ (CC_LANG_CXX)** 已启用

- 在 **Debug facilities** 中：

  - 移除此处所有选项。工具链中可以集成一些调试工具，但它们也可以由根文件系统构建工具来编译。

### 生成工具链

```bash
./ct-ng build
```

工具链默认会安装到 $HOME/x-tools/。这一点本可在 Crosstool-ng 的配置中修改。这一步耗时较久，耐心等待！

### 测试工具链

现在可以测试你的工具链：将 $HOME/x-tools/arm-training-linux-musleabihf/bin/ 添加到 `PATH` 环境变量，并用 `arm-linux-gcc` 编译主实验目录中的简单 `hello.c` 程序：

```bash
arm-linux-gcc -o hello hello.c
```

你可以对生成的二进制文件使用 `file` 命令，确认它确实是为 ARM 架构编译的。

你是否知道，你仍可以在你的 x86 主机上直接执行这个二进制文件？为此，请安装 QEMU 用户态模拟器，它仅模拟目标机的指令集，而非带设备的完整系统：

```bash
sudo apt install qemu-user
```

现在，尝试运行 QEMU ARM 用户态模拟器：

```bash
qemu-arm hello
qemu-arm: Could not open '/lib/ld-musl-armhf.so.1': No such file or directory
```

原因在于 `qemu-arm` 缺少该二进制文件所依赖的共享库加载器（为 ARM 编译）。我们在新编译的工具链中查找它：

```bash
find ~/x-tools -name ld-musl-armhf.so.1
/home/tux/x-tools/arm-training-linux-musleabihf/arm-training-linux-musleabihf/sysroot/lib/ld-musl-armhf.so.1
```

现在可以使用 `qemu-arm` 的 `-L` 选项，告知它共享库所在的位置：

```bash
qemu-arm -L ~/x-tools/arm-training-linux-musleabihf/arm-training-linux-musleabihf/sysroot \
hello
Hello world!
```

### 清理

仅在你存储空间有限时才执行此操作。如果你在工具链配置中犯了错误，可能需要重新运行 Crosstool-ng，保留生成文件可节省大量时间。

要节省约 9 GB 存储空间，可在 Crosstool-NG 源码目录中执行 `./ct-ng clean`。这将删除各工具链组件的源代码，以及所有现已无用的生成文件（因为工具链已安装到 $HOME/x-tools）。
