---
title: "IoT 学习笔记 0x05"
description: "基于 BusyBox 的微型嵌入式系统"
date: "2026-09-13T01:13:26.000Z"
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

# IoT 学习笔记 0x05

> 构建一个虽小但功能完备的嵌入式系统：让内核通过 NFS 从工作站目录启动，手工制作最小化根文件系统，并装上 BusyBox。
>
> 本系列大部分为文档的翻译。**本章踩坑极多（BusyBox 源码版本、kconfig 目标、NFS 导出选项、devtmpfs 挂载）。**

参考资料： [嵌入式 Linux 与内核工程](https://bootlin.com/doc/training/embedded-linux/)

进入 `$HOME/embedded-linux-qemu-labs/tinysystem/` 目录。

## 目标

- 让内核从一个通过 NFS 共享的工作站目录启动。
- 从零创建一个最小化的根文件系统。
- 在文件系统上安装 BusyBox，并基于 `/sbin/init` 写一个简单的启动脚本。
- 为设备搭建一个简单的 Web 界面。

## 内核配置

复用第 4 章位于 `$HOME/embedded-linux-qemu-labs/kernel/` 的内核源码。

确认你的内核配置中已具备通过 NFS 挂载根文件系统所需的全部选项，并且 `CONFIG_DEVTMPFS_MOUNT` 已启用（让内核启动时自动挂载 `/dev`）。如第 4 章所述，这些选项我们都已打开：

```bash
cd ~/embedded-linux-qemu-labs/kernel/linux
scripts/config --enable CONFIG_IP_PNP_DHCP
scripts/config --enable CONFIG_ROOT_NFS
scripts/config --enable CONFIG_DEVTMPFS_MOUNT
make olddefconfig
```

> 内核的 `make` 目标里有 `olddefconfig`（这是内核后加的），但 BusyBox 的 kconfig **没有**这个目标——下面构建 BusyBox 时会踩到，见实战小结。

## 搭建 NFS 服务器

在当前实验目录中创建 `nfsroot` 目录，它用来存放新根文件系统的内容：

```bash
mkdir -p ~/embedded-linux-qemu-labs/tinysystem/nfsroot
```

安装 NFS 服务器（若尚未安装）：

```bash
sudo apt install nfs-kernel-server
```

以 root 身份编辑 `/etc/exports`，添加一行（假设板子 IP 为 `192.168.0.100`，用户名为 `iot`）：

```
/home/iot/embedded-linux-qemu-labs/tinysystem/nfsroot 192.168.0.100(rw,no_root_squash,no_subtree_check)
```

让 NFS 服务器重新加载配置：

```bash
sudo exportfs -r
```

> WSL 环境下 `sudo exportfs -s` 会卡死（守护进程挂起），改用下面这条验证导出是否真正生效：
>
> ```bash
> grep nfsroot /var/lib/nfs/etab
> ```

## 启动系统：设置 NFS 根启动参数

把板子启动到 U-Boot 提示符，在内核启动前设置 `bootargs`，告诉它根文件系统通过 NFS 挂载。这里直接写全，不依赖残留变量：

```
=> setenv bootargs "console=ttyAMA0 root=/dev/nfs ip=192.168.0.100 nfsroot=192.168.0.1:/home/iot/embedded-linux-qemu-labs/tinysystem/nfsroot,nfsvers=3,tcp rw"
=> saveenv
```

> 第 4 章的 `bootcmd` 已经设好自动 `tftp` 拉 `zImage` 和 `dtb` 再 `bootz`，所以 `saveenv` 后直接 `boot` 即可，不用每次手敲。

启动后内核应能挂载 NFS 根：

```
VFS: Mounted root (nfs filesystem) on device 0:13.
```

但此时根文件系统几乎是空的，内核会先报一行、再 panic：

```
devtmpfs: error mounting -2
...
Kernel panic - not syncing: No working init found.
```

- `devtmpfs: error mounting -2`：内核启用了 `CONFIG_DEVTMPFS_MOUNT`，会在早期尝试把 devtmpfs 挂到 `/dev`，但 nfsroot 里没有 `dev` 目录，所以 `-2`（`ENOENT`）。这行不用慌，后面由 rcS 脚本显式挂载解决（见「系统配置与启动」）。
- `No working init found`：nfsroot 里还没有 init 程序，下一步装上 BusyBox 即可消除。

## 使用 BusyBox 构建根文件系统

下载 BusyBox 1.37.x 源码并 checkout 到 1.37.0：

```bash
cd ~/embedded-linux-qemu-labs/tinysystem
git clone https://git.busybox.net/busybox
cd busybox
git fetch origin tag 1_37_0      # shallow clone 时需要这条建立本地 tag ref
git checkout 1_37_0
```

用实验数据目录里现成的 `data/busybox-1.37.config` 作为配置（BusyBox 的配置文件在源码里就是 `.config`）：

```bash
cd ~/embedded-linux-qemu-labs/tinysystem/busybox
cp ../data/busybox-1.37.config .config
export ARCH=arm
export CROSS_COMPILE=arm-linux-
make oldconfig </dev/null        # 非交互刷新配置（注意不是 olddefconfig！）
```

 `make oldconfig` 后**不要**跑 `make menuconfig`：我们直接用预设 config，因此也**不需要**文档里说的 ncurses 补丁（那个 patch 只影响交互式 `menuconfig`，GCC 15 下才触发）。

设置安装目录为 nfsroot，然后编译并安装：

```bash
# 在 menuconfig 里设 Settings -> Install Options -> Destination path for 'make install'
# 也可直接在命令行指定，免去交互配置：
make ARCH=arm CROSS_COMPILE=arm-linux- -j$(nproc)
make ARCH=arm CROSS_COMPILE=arm-linux- CONFIG_PREFIX=~/embedded-linux-qemu-labs/tinysystem/nfsroot install
```

`make install` 完成后，`nfsroot/bin/busybox` 就是二进制，`nfsroot/sbin/init` 软链到 `../bin/busybox`。

> 我们编出来的是**静态链接** BusyBox（config 默认 `CONFIG_STATIC=y`），自包含、不依赖任何库，比文档后续说的「动态链接 + 拷 musl」更稳。init 完全自包含，不用卡库依赖。详见实战小结。

## 虚拟文件系统

现在根文件系统有了 init，但还缺 `proc`/`sys`/`dev` 等。板子启动进 shell 后，`ps` 会报错说 `/proc` 不存在——进程相关命令靠 proc 虚拟文件系统从内核取信息。

启动脚本（下一节）会一次性把这些挂好。先理解要挂载的几种虚拟文件系统：

| 文件系统 | 挂载点 | 作用 |
|---|---|---|
| `proc` | `/proc` | 进程、内核信息（`ps`、`/proc/version` 等） |
| `sysfs` | `/sys` | 设备模型（`/sys/class/net/eth0` 等） |
| `devtmpfs` | `/dev` | 内核已知设备的设备文件（解决上面 `-2`） |
| `tmpfs` | `/tmp` | 内存临时文件 |

## 系统配置与启动

内核执行的第一个用户空间程序是 `/sbin/init`，其配置文件是 `/etc/inittab`。创建一个 `inittab` 和它在其中声明的 `/etc/init.d/rcS` 启动脚本。

`nfsroot/etc/inittab`：

```
::sysinit:/etc/init.d/rcS
ttyAMA0::askfirst:-/bin/sh
::restart:/sbin/init
::ctrlaltdel:/sbin/reboot
::shutdown:/bin/umount -a -r
```

> `ttyAMA0::askfirst:-/bin/sh` 让 shell 跑在真实终端设备 `ttyAMA0` 上，避免 `/bin/sh: can't access tty; job control turned off` 警告（文档用 `::askfirst:/bin/sh` 时出现在 `/dev/console`，不支持作业控制）。

`nfsroot/etc/init.d/rcS`：

```sh
#!/bin/sh
# 挂载四个虚拟文件系统
/bin/mount -t proc proc /proc
/bin/mount -t sysfs sysfs /sys
/bin/mount -t devtmpfs devtmpfs /dev
/bin/mount -t tmpfs tmpfs /tmp

# 回环地址（lo）
/sbin/ifconfig lo 127.0.0.1


```

`rcS` 里这条 `mount -t devtmpfs devtmpfs /dev` 正是用来消除内核早期那行 `devtmpfs: error mounting -2` 的——内核自己自动挂载失败，由 rcS 在用户空间接管，`/dev` 下设备文件由内核填充。

给 rcS 加执行权限：

```bash
chmod +x ~/embedded-linux-qemu-labs/tinysystem/nfsroot/etc/init.d/rcS
```

## 切换到共享库（可选）

文档在这个阶段会让你把 `hello.c` 交叉编译成动态链接、拷 musl 库进 `lib/`，再把 BusyBox 改成动态链接以缩小体积。

我们实际没走这条路，静态链接的 BusyBox 已经自包含、能正常启动，且动态链接在 NFS 根下有 30–60 秒的缓存延迟（改了 `lib/` 后板子要等 NFS 客户端刷新才看得到），对调试不友好。所以 `nfsroot/lib/` 下的 musl 库（如果之前拷贝过 `ld-musl-armhf.so.1` 和 `usr/lib/libc.so`）留着无害，但不影响启动。

> 若你确实要动态链接：从工具链目录 `find ~/x-tools -name ld-musl-armhf.so.1` 找到动态链接器，拷到 `nfsroot/lib/`。Musl 的链接器同时包含 C 库，所以一般只拷这一个文件就够。

## 为设备实现 Web 界面

把 `data/www/` 复制到根文件系统的 `/www`：

```bash
cp -r ~/embedded-linux-qemu-labs/tinysystem/data/www ~/embedded-linux-qemu-labs/tinysystem/nfsroot/www
```

板子 shell 里启动 BusyBox 的 http 服务器：

```sh
/usr/sbin/httpd -h /www/
```

它会自动转入后台。在 Windows 主机浏览器打开 `http://192.168.0.100/`（注意这是 QEMU 运行期间才通，主机 IP 是 `192.168.0.1`，板子 `192.168.0.100`；打不开多半是 Windows 防火墙挡了 80 端口，或浏览器走了代理）。

## 验证：系统成功启动

启动后看到横幅并出现 `#` 提示符，即整条链（U-Boot → 内核 → NFS 根 → init → rcS → shell）跑通：

```
========================================
   Embedded Linux System Started
========================================
Please press Enter to activate this console.
#
```

进 shell 后确认网络真的活了（这段是实测输出）：

```
# ifconfig
eth0      Link encap:Ethernet  HWaddr 52:54:00:12:34:56
          inet addr:192.168.0.100  Bcast:192.168.0.255  Mask:255.255.255.0
          UP BROADCAST RUNNING MULTICAST  MTU:1500  Metric:1
          RX packets:399 errors:0 dropped:0 overruns:0 frame:0
          TX packets:298 errors:0 dropped:0 overruns:0 carrier:0
          collisions:0 txqueuelen:1000
lo        Link encap:Local Loopback
          inet addr:127.0.0.1  Mask:255.0.0.0
          UP LOOPBACK RUNNING  MTU:65536  Metric:1
```

`RX packets:399` 基本就是启动时从主机 `192.168.0.1` 经 NFS 读根文件系统产生的流量，反向证明 NFS-over-TCP 根挂载正常工作。

退出 QEMU：`Ctrl+A` 然后 `X`。
