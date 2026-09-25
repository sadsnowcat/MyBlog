---
title: "iot 学习笔记 0x08"
description: '第三方库与应用程序'
date: "2026-09-23T15:41:19.342Z"
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

# IoT 学习笔记 0x08

> 手动交叉编译第三方库与应用程序：alsa-lib、alsa-utils（autotools）与 ipcalc（Meson）。
>
> 到目前为止，目标机上只跑过 BusyBox 这种只依赖 C 库的程序。本章构建第一个**依赖其他共享库**的程序（speaker-test → libasound），体会手动管理依赖的繁琐——也正是下一章 Buildroot 存在的意义。

参考资料： [嵌入式 Linux 与内核工程](https://bootlin.com/doc/training/embedded-linux/)

实验环境：WSL2 `Ubuntu-24.04`，交叉工具链 `arm-linux-gcc`（musleabihf）。

## 准备：staging 与 target 双空间

```bash
mkdir -p ~/embedded-linux-qemu-labs/thirdparty/{staging,target}

# 复用第 5 章的 BusyBox 根文件系统作为基础
cp -a ~/embedded-linux-qemu-labs/tinysystem/nfsroot/* ~/embedded-linux-qemu-labs/thirdparty/target/
```

两个空间的分工：

- **staging**：所有包 `make install` 的落点。包含未 strip 的库、头文件、文档——只服务于后续编译，不上板
- **target**：真正的根文件系统（NFS 导出给板子）。只手动复制运行所需文件，且全部 strip

## 切换 NFS 导出与启动路径

编辑 `/etc/exports`，把导出目录从旧的 `tinysystem/nfsroot` 换成新目录：

```text
/home/iot/embedded-linux-qemu-labs/thirdparty/target 192.168.0.100(rw,no_root_squash,no_subtree_check)
```

重载并验证：

```bash
sudo exportfs -ra
sudo exportfs -v          # 应只剩 thirdparty/target 一条
```

U-Boot 里同步改 `bootargs` 的 `nfsroot=` 路径：

```text
=> setenv bootargs console=ttyAMA0 root=/dev/nfs ip=192.168.0.100 nfsroot=192.168.0.1:/home/iot/embedded-linux-qemu-labs/thirdparty/target,nfsvers=3,tcp rw
=> saveenv
```

重启进 BusyBox shell，即确认从新目录挂载成功。

## alsa-lib（autotools）

alsa-lib 负责 ALSA 子系统交互。官网下载 1.2.13

```bash
cd ~/embedded-linux-qemu-labs/thirdparty
wget https://www.alsa-project.org/files/pub/lib/alsa-lib-1.2.13.tar.bz2
tar xvf alsa-lib-1.2.13.tar.bz2
cd alsa-lib-1.2.13
```

### configure

直接 `./configure` 会用宿主机 gcc 编出 x86 二进制；`CC=arm-linux-gcc ./configure` 又会在运行测试程序时报 `cannot run C compiled programs`——configure 会编译并**运行**探测程序，交叉编译下必然失败，提示我们用 `--host`。

```bash
./configure --host=arm-linux --disable-topology --prefix=/usr
```

- `--host=arm-linux`：声明交叉编译，CC 由此隐含指定
- `--disable-topology`：alsa-lib 本身能编过，但后面编 alsa-utils 会出问题，必须禁
- `--prefix=/usr`：前缀是**目标机上的路径**（运行时库在 `/usr/lib`），绝不能写宿主机路径，否则程序上板后会去不存在的目录找文件

### 构建、安装、上板

```bash
make -j$(nproc)

arm-linux-readelf -d src/.libs/libasound.so.2.0.0 | grep -E 'SONAME|NEEDED'

make DESTDIR=$HOME/embedded-linux-qemu-labs/thirdparty/staging install
```

复制运行时文件到目标空间并 strip：

```bash
cd ~/embedded-linux-qemu-labs/thirdparty
mkdir -p target/usr/lib
cp -a staging/usr/lib/libasound.so.2* target/usr/lib

ls -l target/usr/lib/libasound.so.2.0.0      # strip 前
arm-linux-strip target/usr/lib/libasound.so.2.0.0
ls -l target/usr/lib/libasound.so.2.0.0      # strip 后
```

实测：staging 未 strip 版 **4077964** 字节 → target strip 后 **881500** 字节，省下约 **3.1 MB**。

配置文件也要上板，并修正一个假设：

```bash
mkdir -p target/usr/share
cp -a staging/usr/share/alsa target/usr/share

# alsa.conf 假设存在 audio 组，微型系统上没有，改为 gid 0
sed -i 's/^defaults.pcm.ipc_gid audio/defaults.pcm.ipc_gid 0/' target/usr/share/alsa/alsa.conf
```

## alsa-utils（autotools + 依赖头文件/库）

构建需要 gettext：`sudo apt install gettext`。同样从官网下载 1.2.13 并解压。

configure 的报错是**渐进式**的，每解决一个才暴露下一个：

| 报错 | 原因 | 解法 |
|---|---|---|
| `Sufficiently new version of libasound not found` | 找不到 `alsa/asoundlib.h` 头文件 | `CPPFLAGS=-I.../staging/usr/include` |
| `No linkable libasound was found` | 链接器找不到库 | `LDFLAGS=-L.../staging/usr/lib` |
| 缺 curses 头文件 | alsamixer 需要 ncurses | `--disable-alsamixer`（不用它） |
| `mv: cannot stat 't-ja.gmo'` | alsaconf 的翻译文件问题 | `--disable-alsaconf` |

最终命令：

```bash
LDFLAGS=-L$HOME/embedded-linux-qemu-labs/thirdparty/staging/usr/lib \
CPPFLAGS=-I$HOME/embedded-linux-qemu-labs/thirdparty/staging/usr/include \
./configure --host=arm-linux --prefix=/usr \
--disable-alsamixer --disable-alsaconf

make -j$(nproc)
```

先装到 `/tmp/alsa-utils/` 用 `tree` 检查会装什么（避免污染 staging），确认后正式安装：

```bash
make DESTDIR=/tmp/alsa-utils/ install
make DESTDIR=$HOME/embedded-linux-qemu-labs/thirdparty/staging install
```

只把需要的 `speaker-test` 上板并 strip（78884 → **26312** 字节）：

```bash
cd ~/embedded-linux-qemu-labs/thirdparty
cp -a staging/usr/bin/speaker-test target/usr/bin/
arm-linux-strip target/usr/bin/speaker-test
```

`DESTDIR` 与 `--prefix` 的关系：automake 系 Makefile 都支持 `DESTDIR`，文件装到 `DESTDIR/配置前缀`——前缀定运行时位置，DESTDIR 定宿主机落点，二者正交。

### 上板测试

> 听不到声音是已知问题：QEMU 在 WSL 下没有音频路由到 Windows 声卡（Bootlin 文档也注明部分 Ubuntu/QEMU 版本无声）。**程序执行不报错即为构建正确**。

## ipcalc（Meson）

无依赖的 Meson 包，作为交叉编译 Meson 的入门：

```bash
sudo apt install meson

cd ~/embedded-linux-qemu-labs/thirdparty
git clone https://gitlab.com/ipcalc/ipcalc.git
cd ipcalc/
git checkout 1.0.3
```

创建 `thirdparty/cross-file.txt`：

```text
[binaries]
c = 'arm-linux-gcc'

[host_machine]
system = 'linux'
cpu_family = 'arm'
cpu = 'cortex-a9'
endian = 'little'
```

Meson 要求 out-of-tree 构建：

```bash
mkdir cross-build
cd cross-build
meson --cross-file ../../cross-file.txt --prefix /usr ..
ninja
DESTDIR=$HOME/embedded-linux-qemu-labs/thirdparty/staging ninja install
```

复制上板并 strip（83316 → **46996** 字节）：

```bash
cd ../..
cp staging/usr/bin/ipcalc target/usr/bin/
arm-linux-strip target/usr/bin/ipcalc

# 确认是 ARM 可执行文件
arm-linux-readelf -h staging/usr/bin/ipcalc | grep -E 'Class|Machine'
# Class: ELF32 / Machine: ARM
```

板上验证：

```sh
# ipcalc 192.168.0.100
Address: 192.168.0.100
Address space: Private Use
```
