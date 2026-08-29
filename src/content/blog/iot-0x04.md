---
title: "IoT 学习笔记 0x04"
description: "内核交叉编译"
date: "2026-08-29T10:39:18.275Z"
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

# IoT 学习笔记 0x04

> 如何为 ARM 目标平台交叉编译一个内核。

进入 `$HOME/embedded-linux-qemu-labs/kernel` 目录。

## 选择一个特定的 Linux 稳定版本

我们将使用 `linux-6.1.x`，首先，获取我们可用的分支列表：

```bash
cd linux
git branch -a
```

首先，执行以下命令检查你当前拥有的版本：你也可以打开 `Makefile` 并查看其开头部分来核对这一信息。

```bash
make kernelversion
```

现在，让我们基于该远程分支创建一个本地分支：

```bash
git checkout linux-6.1.y
```

再次使用 `make kernelversion` 命令检查版本，确保你现在拥有的是 6.1.x 版本。我们检出的结果是 `6.1.186`（`linux-6.1.y` 分支上的最新补丁版本）。

## 交叉编译环境搭建

要交叉编译 Linux，你需要一个交叉编译工具链。我们将使用之前构建的交叉编译工具链，因此只需将其加入 `PATH`：

```bash
export PATH=$HOME/x-tools/arm-training-linux-musleabihf/bin:$PATH
```

另外，别忘了还要做到以下之一：

- 在环境中定义 `ARCH` 和 `CROSS_COMPILE` 变量的值（使用 `export`）
- 或者在每次调用 `make` 时在命令行中指定它们，例如：`make ARCH=... CROSS_COMPILE=... <target>`

我们假定 `ARCH` 和 `CROSS_COMPILE` 变量已经通过 `export` 导出。

注意 `.bashrc` 里通常只有工具链的 `PATH`，这两个变量需要在新终端里手动 `export`（或每次 `make` 时在命令行指定），否则 `make` 会按宿主机的 x86_64 架构去配置内核，编出来的东西根本跑不了。

## Install dependencies（安装依赖）

要构建 Linux 内核，你需要安装 `bc` 工具：

```bash
sudo apt install bc
```

## Linux kernel configuration（Linux 内核配置）

通过运行 `make help`，查找为你的处理器配置内核所需的正确的 Makefile 目标。

在本课程情况下，使用 ARM Vexpress 板卡（`vexpress_defconfig`）的配置。

因此，运行 `make <default-configuration>` 应用该配置，然后运行 `make menuconfig` 进行微调。

- 如果设置了 `CONFIG_GCC_PLUGINS`，请将其禁用。这将跳过构建特殊的 gcc 插件，否则会需要额外的构建依赖。同时启动 `make menuconfig`，将 `CONFIG_DEVTMPFS_MOUNT` 添加到你的配置中（让内核启动时自动挂载 `/dev`）。

这两项也可以用 `scripts/config` 在命令行完成，效果与 menuconfig 相同：

```bash
make vexpress_defconfig
scripts/config --disable CONFIG_GCC_PLUGINS
scripts/config --enable CONFIG_DEVTMPFS_MOUNT
make olddefconfig
```

## Cross compiling（交叉编译）

你现在可以开始交叉编译内核了。只需运行：

```bash
make
```

然后等待内核编译完成。如果你的机器有多个核心，别忘了使用 `make -j<n>`！我们实际用 `make -j$(nproc)` 并行编译（`nproc` 返回 CPU 核心数）。

查看内核构建输出，以了解内核镜像包含在哪个文件中。对我们来说，镜像在 `arch/arm/boot/zImage`。

同时查看设备树源目录，看看生成了哪些 `.dtb` 文件。找到与你的板卡对应的 `.dtb` 文件：`arch/arm/boot/dts/vexpress-v2p-ca9.dtb`。

### Load and boot the kernel using U-Boot（使用 U-Boot 加载并启动内核）

由于我们将从 U-Boot 启动 Linux 内核，需要设置与 Linux 内核命令行对应的 `bootargs` 环境变量：

```
=> setenv bootargs console=ttyAMA0
=> saveenv
```

我们将使用 TFTP 将内核镜像加载到板卡上：

- 在你的工作站上，将 `zImage` 和 DTB（`vexpress-v2p-ca9.dtb`）复制到 TFTP 服务器所暴露的目录中（TFTP 目录属主是 root，需要 sudo）：

```bash
sudo cp arch/arm/boot/zImage /srv/tftp/
sudo cp arch/arm/boot/dts/vexpress-v2p-ca9.dtb /srv/tftp/
```

- 在目标机（U-Boot 提示符下），从 TFTP 将 `zImage` 加载到 RAM 中（若报 `*** ERROR: 'ipaddr' not set`，是 U-Boot 网络栈的内部 IP 状态在板子复位后失效了，重新 `setenv ipaddr`/`serverip` 一次即可刷新）：

```
=> tftp 0x61000000 zImage
```

- 现在，同样将 DTB 文件加载到 RAM 中：

```
=> tftp 0x62000000 vexpress-v2p-ca9.dtb
```

- 使用设备树启动内核：

```
=> bootz 0x61000000 - 0x62000000
```

你应该会看到 Linux 启动（串口控制台、SD 卡识别 `mmcblk0: p1 p2 p3` 等），并最终发生 panic：

```
Kernel panic - not syncing: VFS: Unable to mount root fs on unknown-block(0,0)
```

这是预期之中的：我们还没有为设备提供可用的根文件系统，`bootargs` 里也没有 `root=` 指明根设备在哪。能看到这行 panic，反而证明内核编译与启动链路全部打通。

你现在可以将这一切在每次板卡启动或复位时自动化。复位板卡，并自定义 `bootcmd`：

```
=> setenv bootcmd 'tftp 0x61000000 zImage; tftp 0x62000000 vexpress-v2p-ca9.dtb; bootz
0x61000000 - 0x62000000'
=> saveenv
```

重启板卡，确认内核启动现在已经自动化。
