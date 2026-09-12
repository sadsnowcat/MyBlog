---
title: "IoT 学习笔记 0x02"
description: "引导加载程序 —— U-Boot"
date: "2026-08-28T09:38:29.574Z"
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

# IoT 学习笔记 0x02

编译并安装 U-Boot 引导加载程序，使用基本的 U-Boot 命令，并建立与开发工作站之间的 TFTP 通信。

进入 $HOME/embedded-linux-qemu-labs/bootloader 目录。

安装 `qemu-system-arm` 软件包。在本实验及后续实验中，我们将使用 QEMU 模拟的 ARM Vexpress Cortex A9 板。

## 配置并构建 U-Boot

下载 U-Boot：

```bash
cd ~/embedded-linux-qemu-labs/bootloader
git clone https://gitlab.denx.de/u-boot/u-boot
cd u-boot
git checkout v2023.01
```

现在配置 U-Boot 以支持 ARM Vexpress Cortex A9 板（`vexpress_ca9x4_defconfig`）。

通过阅读 `README` 文件（特别是 *Building the Software* 一节）了解 U-Boot 的配置与编译步骤。

基本上，你需要指定交叉编译器前缀（即交叉编译器可执行文件名中 `gcc` 之前的部分）：

```bash
export CROSS_COMPILE=arm-linux-
```

现在你已有有效的初始配置，运行 `make menuconfig` 以进一步编辑引导加载程序的功能：

- 在 **Environment** 子菜单中，我们将配置 U-Boot，使其将环境变量保存到一个名为 `uboot.env` 的文件中，该文件位于 MMC/SD 卡上的 FAT 文件系统里，因为我们模拟的机器没有闪存：

- 取消 **Environment in flash memory (CONFIG_ENV_IS_IN_FLASH)**

- 设置 **Environment is in a FAT filesystem (CONFIG_ENV_IS_IN_FAT)**

- 设置 **Name of the block device for the environment (CONFIG_ENV_FAT_INTERFACE)**：`mmc`

- 设置 **Device and partition for where to store the environment in FAT (CONFIG_ENV_FAT_DEVICE_AND_PART)**：`0:1`

上述两项设置对应于 `fatload` 命令的参数。

- 另外，添加对 `editenv` (`CONFIG_CMD_EDITENV`) 和 `bootd`（可缩写为 `boot`，`CONFIG_CMD_BOOTD`）的支持，它们不在我们板子的默认配置中

为避免误操作 menuconfig 顶层的单选项 **Architecture select**（误改会把 ARM 架构切换为 Sandbox 而破坏整个配置），也可以用 U-Boot 自带的 `scripts/config` 脚本在命令行完成上述修改，再 `make olddefconfig` 补全依赖：

```bash
./scripts/config --disable CONFIG_ENV_IS_IN_FLASH
./scripts/config --enable CONFIG_ENV_IS_IN_FAT
./scripts/config --set-str CONFIG_ENV_FAT_INTERFACE mmc
./scripts/config --set-str CONFIG_ENV_FAT_DEVICE_AND_PART "0:1"
./scripts/config --enable CONFIG_CMD_BOOTD
./scripts/config --enable CONFIG_CMD_EDITENV
make olddefconfig
```

最后，运行

```bash
export CROSS_COMPILE=arm-linux-
make -j$(nproc)
```

这将构建 U-Boot 。这将生成若干二进制文件，包括 `u-boot` 和 `u-boot.bin`。

## 测试 U-Boot

仍在 U-Boot 源码目录中，测试 U-Boot 是否正常工作：

```bash
qemu-system-arm -M vexpress-a9 -m 128M -nographic -kernel u-boot
```

• `-M`：模拟的机器

• `-m`：模拟机器中的内存大小

• `-kernel`：允许直接将二进制文件加载到模拟机器中并运行。这样你就不需要一级引导加载程序了。当然，真实硬件上不会有这一便利。

在超时结束前按任意键，即可进入 U-Boot 提示符。

随后你可以输入 `help` 命令，探索可用的少量命令。

注意：要退出 QEMU，先按 `[Ctrl][a]`，再按 `[h]` 查看可用命令。其中 `[Ctrl][a]` 后跟 `[x]` 可退出模拟器。

## SD 卡设置

回到主 bootloader 目录。我们现在需要给 QEMU 虚拟机添加一张 SD 卡镜像，尤其是为了获得一种保存 U-Boot 环境变量的方式。在后续实验中，我们还会将此类存储用于其它用途（保存内核、设备树、根文件系统以及其它文件系统）。

我们将要使用的命令会在 *Block filesystems*（块文件系统）课程中进一步讲解。

首先，使用 `dd` 命令创建一个填满零、大小为 1 GB、名为 `sd.img` 的文件：QEMU 会将其用作 SD 卡磁盘镜像。

```bash
dd if=/dev/zero of=sd.img bs=1M count=1024
```

现在，使用 `cfdisk` 命令创建我们将要使用的分区：

```bash
cfdisk sd.img
```

如果 `cfdisk` 提示 *Select a label type*（选择标签类型），请选择 `dos`，因为我们的实验并不需要 `gpt` 分区表。

在 `cfdisk` 界面中，从头开始创建三个主分区，属性如下：

- 一个分区，大小为 64 MB，分区类型为 FAT16。将此分区标记为 bootable。
- 一个分区，大小为 8 MB³，将用于根文件系统。由于设备的几何结构，该分区可能大于 8 MB，但这无关紧要。该分区保持 Linux 类型。
- 一个分区，占用 SD 卡镜像的剩余空间，将用于数据文件系统。同样，该分区保持 Linux 类型。

完成后按 *Write*（写入）。

我们现在使用 loop 驱动，从该镜像及其分区模拟出块设备：

```bash
sudo losetup -f --show --partscan sd.img
```

- `-f`：查找一个空闲的 loop 设备
- `--show`：显示所使用的 loop 设备
- `--partscan`：扫描 loop 设备上的分区，并创建额外的 `/dev/loop<x>p<y>` 块设备。

另外运行 `sudo dmesg`，确认 `losetup` 选中的 loop 设备检测到了 3 个分区：

```
[62778.965018] loop13: detected capacity change from 0 to 2097152
[62778.966862]
loop13: p1 p2 p3
```

最后，将第一个分区格式化为带 `boot` 标签的 FAT16：其余分区稍后再格式化。

```bash
sudo mkfs.vfat -F 16 -n boot /dev/loop<x>p1
```

现在可以释放 loop 设备：

```bash
sudo losetup -d /dev/loop<x>
```

## 测试 U-Boot 的环境变量

再次启动 QEMU，但这次带上模拟的 SD 卡（命令可写在一行内）：

```bash
qemu-system-arm -M vexpress-a9 -m 128M -nographic \
-kernel u-boot/u-boot \
-sd sd.img
```

现在，在 U-Boot 提示符下，确认你可以设置并保存一个环境变量：

```bash
setenv foo bar
saveenv
```

输入 `reset` 重启板子，然后检查 `foo` 变量是否仍然被设置：

```bash
printenv foo
```

## 建立 QEMU 与主机之间的网络连接

QEMU 用 tap 网络把虚拟板和主机连成对等网络。写一个 ifup 脚本放在 `bootloader/` 目录（QEMU 命令里 `script=./qemu-myifup` 是相对路径）：

```bash
cat > qemu-myifup <<'EOF'
#!/bin/sh
/sbin/ip a add 192.168.0.1/24 dev $1
/sbin/ip link set $1 up
EOF
chmod +x qemu-myifup
```

带网络启动（创建 tap 设备需要 root）：

```bash
sudo qemu-system-arm -M vexpress-a9 -m 128M -nographic \
  -kernel u-boot/u-boot -sd sd.img \
  -net tap,script=./qemu-myifup -net nic
```

（QEMU 启动日志里关于音频设备 ALSA 的报错，以及成串的 `BOOTP broadcast`，均为正常现象：前者因为 WSL 没有声卡，后者是板子默认启动流程在没有内核时广播寻找 DHCP 服务器，到第 3 章放入内核后即消失。）

U-Boot 里配置板子侧 IP：

```
=> setenv ipaddr 192.168.0.100
=> setenv serverip 192.168.0.1
=> saveenv
=> ping 192.168.0.1     # host 192.168.0.1 is alive
```

## 搭建 TFTP 服务器

主机装 TFTP 服务器：

```bash
sudo apt install tftpd-hpa
```

放一个测试文件：

```bash
echo "TFTP test ok" | sudo tee /srv/tftp/textfile.txt
```

用 `bdinfo` 确认内存布局（RAM 从 `0x60000000` 起 128M，顶部约 21M 为 U-Boot 自身保留区），选 `0x61000000` 作下载地址。

传输前先确认板子侧网络环境已就绪。`tftp` 实际使用的是 U-Boot 网络栈内部的 IP 状态，它只在环境变量发生变更时重新解析；若启动后 autoboot 已执行过失败的 BOOTP，可能出现 `bdinfo` 显示 IP 已设置、但 `tftp` 仍报 `ipaddr' not set` 的情况，重新执行一次 `setenv`（即使值相同，也会触发环境变更、刷新内部状态）即可：

```
=> setenv ipaddr 192.168.0.100
=> setenv serverip 192.168.0.1
=> setenv netmask 255.255.255.0
=> saveenv
```

在 U-Boot 提示符下通过 TFTP 拉取文件并查看内存内容：

```
=> tftp 0x61000000 textfile.txt
...
Bytes transferred = 13 (d hex)

=> md.b 0x61000000
61000000: 54 46 54 50 20 74 65 73 74 20 6f 6b 0a ...  TFTP test ok....
```

`md.b` 开头的 `54 46 54 50` 正是 "TFTP" 的 ASCII 码，说明文件经网络原样送达板子内存。这条 TFTP 通道即第 3 章向板子传输内核（`zImage` 与设备树）所使用的方式。
