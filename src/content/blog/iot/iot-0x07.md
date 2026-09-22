---
title: "IoT 学习笔记 0x07"
description: "块设备文件系统"
date: "2026-09-22T15:30:00.000Z"
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

# IoT 学习笔记 0x07

> 配置并启动一个依赖块存储的嵌入式 Linux 系统。
>
> 在完成"一个微型嵌入式系统"实验之后，我们将把文件系统内容复制到模拟的 SD 卡中。存储将被划分为多个分区，QEMU 模拟开发板将从这个 SD 卡启动，**不再使用 NFS**。

参考资料： [嵌入式 Linux 与内核工程](https://bootlin.com/doc/training/embedded-linux/)

本实验继续使用 `$HOME/embedded-qemu-labs/tinysystem/nfsroot` 下的根文件系统，逐步改造成块设备启动。最终架构：

```
SD 卡 (sd.img, 1GB)
├── 分区 1  FAT16  64M   ← 内核 zImage + DTB（U-Boot fatload 读取）
├── 分区 2  ext    8M    ← SquashFS 只读根文件系统
└── 分区 3  ext4   951M  ← 可写数据分区（上传文件）
```

## 内核中的文件系统支持

重新编译内核，加入对 **SquashFS** 和 **ext4** 的支持（基本配置选项即可，无需扩展属性等功能）：

```bash
cd ~/embedded-linux-qemu-labs/kernel/linux
make menuconfig
```

需要确认/勾选的项（选 `<*>` 内建，不要 `<M>` 模块）：

| menuconfig 路径 | 选项 | 用途 |
|---|---|---|
| File systems → The Extended 4 (ext4) filesystem | ext4 | 数据分区 |
| File systems → Miscellaneous filesystems → SquashFS 4.0 | squashfs | 只读根 |
| File systems → DOS/FAT/EXFAT/NT Filesystems | VFAT | FAT 分区加载内核 |
| File systems → Network File Systems | NFS client + NFSv3 | 过渡期仍用 NFS 启动 |

重新编译并确认 `zImage` 时间戳已更新：

```bash
make -j$(nproc)
stat -c '%y %s' arch/arm/boot/zImage
```

用新内核从 NFS 启动，检查支持情况：

```sh
# cat /proc/filesystems | grep -E 'ext4|squashfs'
```

## 格式化第三个分区

先让板子 `halt` 退出 QEMU，然后在宿主机操作：

```bash
cd ~/embedded-linux-qemu-labs/bootloader

# 确认分区表（应有 3 个分区）
sudo fdisk -l sd.img

# 关联 loop 设备，--partscan 让内核扫描出 p1/p2/p3
sudo losetup -f --show --partscan sd.img     # 输出如 /dev/loop0

# 把第 3 分区格成 ext4，卷标 data
sudo mkfs.ext4 -L data /dev/loop0p3

# 挂载，把上传文件搬进去（作为可写存储区）
sudo mkdir -p /mnt/data
sudo mount /dev/loop0p3 /mnt/data
sudo cp -a ~/embedded-linux-qemu-labs/tinysystem/nfsroot/www/upload/files/. /mnt/data/

# 卸载并释放 loop
sudo umount /mnt/data
sudo losetup -d /dev/loop0
```

## 添加用于日志文件的 tmpfs 分区

上传脚本原本把日志写在 `/www/upload/files/upload.log`，和上传文件混在一起。改为存放在 `/var/log` 并挂 tmpfs——重启即清空，正是 tmpfs 的用途：**不需要跨重启保留的临时数据**。

```bash
# 1. 根文件系统里建目录（NFS rootfs 直接在宿主机改）
mkdir -p ~/embedded-linux-qemu-labs/tinysystem/nfsroot/var/log

# 2. 修改 www/cgi-bin/upload.cfg 的日志路径
#    LogFile       = /var/log/upload.log
```

**先在目标机上手动测试挂载命令，再写进启动脚本**：

```sh
# mount -t tmpfs tmpfs /var/log
# mount | grep var
tmpfs on /var/log type tmpfs (rw,relatime)
```

测试通过后写入 `nfsroot/etc/init.d/rcS`（在挂 `/tmp` 那行旁）：

```sh
/bin/mount -t tmpfs tmpfs /var/log
```

重启验证：开机后 `mount | grep /var/log` 应自动出现 tmpfs，且上次 `touch` 的测试文件消失（tmpfs 在内存里，符合预期）。

## 制作 SquashFS 镜像

把整个根文件系统压成 SquashFS，写进 SD 卡第 2 分区：

```bash
# 宿主机需安装 squashfs-tools
cd ~/embedded-linux-qemu-labs/tinysystem
mksquashfs nfsroot rootfs.squashfs -noappend    # -noappend 很重要，见踩坑
ls -lh rootfs.squashfs                          # 必须 < 分区2 大小（8M）

# 写入第 2 分区
cd ~/embedded-linux-qemu-labs/bootloader
sudo losetup -f --show --partscan sd.img
sudo dd if=../tinysystem/rootfs.squashfs of=/dev/loop0p2 bs=4M conv=fsync
sudo losetup -d /dev/loop0
```

清理 C++ 库后实测：71M 的 nfsroot 压出 **760K** 的 squashfs，gzip 压缩比 31%。

## 从 SquashFS 分区启动

打断 autoboot，修改内核命令行——根文件系统改为 SD 卡第 2 分区：

```text
=> setenv bootargs root=/dev/mmcblk0p2 rootwait rw ip=192.168.0.100 console=ttyAMA0
=> saveenv
=> run bootcmd
```

关键参数：

- `root=/dev/mmcblk0p2`：MMC 块设备（SD 卡）第 2 分区
- **`rootwait`**：内核异步检测 SD 卡，没有它内核会在卡就绪前抢挂根文件系统而 panic
- 保留 `ip=` 是为了 Web 上传界面还能用

成功标志：

```
VFS: Mounted root (squashfs filesystem) readonly on device 179:2.
```

验证（squashfs 天生只读）：

```sh
# mount | grep root
/dev/root on / type squashfs (ro,relatime,errors=continue)
# touch /try.txt
touch: /try.txt: Read-only file system      # 正常！
```

## 将内核镜像与 DTB 存放到 SD 卡上

最后一步摆脱网络加载：把内核和设备树复制进 FAT 分区，U-Boot 改从 SD 卡读。

```bash
cd ~/embedded-linux-qemu-labs/bootloader
sudo losetup -f --show --partscan sd.img

sudo mkdir -p /mnt/boot
sudo mount /dev/loop0p1 /mnt/boot             # 分区 1 = FAT
sudo cp ~/embedded-linux-qemu-labs/kernel/linux/arch/arm/boot/zImage /mnt/boot/
sudo cp ~/embedded-linux-qemu-labs/kernel/linux/arch/arm/boot/dts/vexpress-v2p-ca9.dtb /mnt/boot/
sudo umount /mnt/boot
sudo losetup -d /dev/loop0
```

调整 U-Boot `bootcmd`，从 FAT 分区加载内核和 DTB（地址与之前 TFTP 相同）：

```text
=> setenv bootcmd 'fatload mmc 0:1 0x61000000 zImage; fatload mmc 0:1 0x62000000 vexpress-v2p-ca9.dtb; bootz 0x61000000 - 0x62000000'
=> saveenv
=> reset
```

`fatload mmc 0:1 <addr> <file>`：从第 1 个 MMC 控制器的第 1 分区读文件到内存。

终极验证：停掉宿主机的 TFTP（`sudo service tftpd-hpa stop`）再 `reset`——系统照样从 SD 卡一路启动到 BusyBox shell，完全自包含：

```sh
# mount
/dev/root on / type squashfs (ro,relatime,errors=continue)
devtmpfs on /dev type devtmpfs (rw,relatime,size=49968k,nr_inodes=12492,mode=755)
proc on /proc type proc (rw,relatime)
sysfs on /sys type sysfs (rw,relatime)
tmpfs on /tmp type tmpfs (rw,relatime)
tmpfs on /var/log type tmpfs (rw,relatime)
```

## 实战踩坑

最初 `mksquashfs` 出来 **23M**（分区 2 只有 8M）。`du -ah nfsroot | sort -rh` 排查：当初从工具链 sysroot 复制 musl 动态链接器时整锅端，带进了 `libstdc++.a`（31M）、`libstdc++.so`（18M）等一堆 C++/GCC 运行库。BusyBox + musl 纯 C 系统**一个都用不到**，真正需要的只有 `lib/ld-musl-armhf.so.1 -> ../usr/lib/libc.so`。挪走后 nfsroot 从 71M 瘦身到 1.5M，squashfs 仅 760K。

对已存在的镜像再跑 `mksquashfs` 会**追加**而不是重建（输出 `Appending to existing filesystem`、`Source directory entry usr already used! - trying usr_1`），产生 `usr_1` 之类的重复目录，大小不变。重做镜像要么先 `rm` 旧文件，要么加 **`-noappend`**。



- QEMU 在 WSL 下刷一屏 ALSA/PipeWire 报错：WSL 无声卡，**无害**，忽略。
- `Image format was not specified for 'sd.img'` 警告：可改用 `-drive file=sd.img,format=raw,if=sd` 消除。
- WSL 下 `systemctl` 会卡死（无 systemd），用 `service <name> start` 或 `/etc/init.d/<name> start` 代替。
