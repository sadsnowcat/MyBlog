---
title: "iot-0x09"
description: '使用构建系统（以 Buildroot 为例）'
date: "2026-09-24T13:43:26.508Z"
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

# iot-0x09

> 了解构建系统如何使用及其工作原理，以 Buildroot 构建系统为例。构建一个完整的 Linux 系统，包括 Linux 内核。

### 本节目标（Goals）

与上一次实验相比，我们将构建一个更为复杂的系统，其中仍然包含 alsa-utils（当然还有它所依赖的 alsa-lib），但这一次我们将使用 Buildroot 这个自动化构建系统。

借助这个自动化构建系统，我们还能够添加更多软件包，并在系统上播放真实的音频，这要归功于 Music Player Daemon（mpd）（https://www.musicpd.org/）及其 mpc 客户端。

如同在真实项目中一样，我们还将通过 Buildroot 构建 Linux 内核，并将内核模块安装到根文件系统中。

重要说明：由于前面提到的声音播放问题，本次实验相比我们在真实硬件上的说明会略为简略。不过，你应该能够在 QEMU 模拟的机器中运行这些命令，以此证明这些工具已经被正确构建。因此，我们将构建 mpd 和 mpc 等工具，但由于没有声音，不会对它们进行测试。

### 环境准备（Setup）

进入 `$HOME/embedded-linux-qemu-labs/buildroot` 目录。

### 获取 Buildroot 并浏览源代码

Buildroot 官方网站位于 https://buildroot.org/。克隆 Git 仓库：

```bash
git clone https://gitlab.com/buildroot.org/buildroot.git
cd buildroot
```

现在检出与最新的 2023.02.<n> 版本（长期支持版）相对应的 tag，我们已经针对该版本测试了本次实验。

可以看到若干个子目录或文件，其中最重要的有：

- `boot` 包含用于编译常用引导加载程序（GRUB、U-Boot、Barebox 等）的 Makefile 和配置项。
- `board` 包含特定于开发板的配置以及根文件系统覆盖层。
- `configs` 包含一组预定义的配置，类似于内核中 defconfig 的概念。
- `docs` 包含 Buildroot 的文档。
- `fs` 包含用于生成各种根文件系统镜像格式的代码。
- `linux` 包含用于编译 Linux 内核的 Makefile 和配置项。
- `Makefile` 是我们将用来操作 Buildroot 的主 Makefile：在 Buildroot 中，所有工作都是通过 Makefile 完成的。

- `package` 是一个目录，其中包含了用于编译嵌入式 Linux 系统用户空间应用程序和库的所有 Makefile、补丁和配置项。请查看其中的各个子目录，了解它们所包含的内容。
- `system` 包含根文件系统骨架以及在使用静态 `/dev` 时所使用的设备表。
- `toolchain` 包含用于生成交叉编译工具链的 Makefile、补丁和配置项。

### 配置 Buildroot

在我们的例子中，我们希望：

- 为 ARM 生成一个嵌入式 Linux 系统；
- 使用已有的外部工具链，而不是让 Buildroot 为我们生成一个；
- 编译 Linux 内核并将其模块部署到根文件系统中；
- 将 BusyBox、alsa-utils、mpd、mpc 和 evtest 集成到我们的嵌入式 Linux 系统中；
- 将目标文件系统打包成一个 tar 包。

要运行 Buildroot 的配置工具，只需执行：

```bash
make menuconfig
```

设置以下选项。如果需要对某个具体选项了解更多细节，随时可以按下 Help 按钮：

- Target options（目标选项）
  - Target Architecture（目标架构）：ARM（little endian，小端）
  - Target Architecture Variant（目标架构变体）：cortex-A9
  - Enable NEON SIMD extension support（启用 NEON SIMD 扩展支持）：Enabled（已启用）
  - Enable VFP extension support（启用 VFP 扩展支持）：Enabled（已启用）
  - Target ABI（目标 ABI）：EABIhf
  - Floating point strategy（浮点策略）：VFPv3-D16
- Toolchain（工具链）
  - Toolchain type（工具链类型）：External toolchain（外部工具链）
  - Toolchain（工具链）：Custom toolchain（自定义工具链）
  - Toolchain path（工具链路径）：使用你构建的工具链：`/home/<user>/x-tools/arm-training-linux-musleabihf`（将 `<user>` 替换为你的实际用户名）
  - External toolchain gcc version（外部工具链 gcc 版本）：12.x
  - External toolchain kernel headers series（外部工具链内核头文件系列）：6.1.x 或更高
  - External toolchain C library（外部工具链 C 库）：musl（experimental，实验性）
  - 我们必须向 Buildroot 告知我们的工具链配置，因此请选中 Toolchain has SSP support?（工具链是否支持 SSP？）和 Toolchain has C++ support?（工具链是否支持 C++？）。Buildroot 无论如何都会检查这些参数。
- Kernel（内核）
  - 启用 Linux Kernel（Linux 内核）。
  - 将 Kernel version（内核版本）设为 Latest version (6.1)（最新版本 6.1）。
  - 将 Kernel configuration（内核配置）设为 Using an in-tree defconfig file（使用树内 defconfig 文件）。
  - 将 Defconfig name（defconfig 名称）设为 vexpress。
  - 选中 Build a Device Tree Blob (DTB)（构建设备树 Blob）。
  - 将 In-tree Device Tree Source file names（树内设备树源文件名）设为 vexpress-v2p-ca9。
- Target packages（目标软件包）
  - 保留 BusyBox（默认版本）并保留 Buildroot 所建议的 BusyBox 配置；
  - Audio and video applications（音频和视频应用程序）：
    - 选中 alsa-utils，并在子菜单中：
      - 选中 alsamixer。你也将能够测试这个应用程序，同时它还会引入 ncurses 库，我们在下一次实验中也会用到它。
      - 选中 speaker-test。
    - 选中 mpd，并在子菜单中：
      - 仅保留 alsa、vorbis 和 tcp sockets。
    - 选中 mpd-mpc。
- Filesystem images（文件系统镜像）
  - 选中 tar the root filesystem（将根文件系统打包为 tar）。

退出 menuconfig 界面。你的配置现在已被保存到 `.config` 文件中。

### 生成嵌入式 Linux 系统

只需运行：

```bash
make
```

Buildroot 首先会利用外部工具链创建一个小型环境，然后下载、解压、配置、编译并安装嵌入式系统的各个组件。

所有编译工作都在 `output/` 子目录中进行。让我们来查看它的内容：

- `build`，是 Buildroot 所构建的每个组件被解压到其中、并且实际进行构建的目录；
- `host`，是 Buildroot 为主机安装部分组件的目录。由于 Buildroot 不希望过分依赖开发机器上已安装的过多内容，它会安装一些在为目标板编译软件包时所需的工具。在我们的例子中，它安装了 pkg-config（因为主机上的版本可能过于陈旧）以及用于生成根文件系统镜像的工具（genext2fs、makedevs、fakeroot）；
- `images`，包含 Buildroot 生成的最终镜像。在我们的例子中，它包含名为 `rootfs.tar` 的文件系统 tar 包，以及经过压缩的内核和设备树二进制文件。根据配置的不同，其中还可能会有引导加载程序二进制文件或一张完整的 SD 卡镜像；
- `staging`，包含目标系统的“构建”空间。所有目标库及其头文件和文档都在其中。它还包括系统头文件和 C 库，在我们的例子中，这些是从交叉编译工具链复制过来的；
- `target`，是目标根文件系统。所有应用程序和库（通常已被 strip）都安装在此目录中。不过，它不能直接用作根文件系统，因为其中缺少所有的设备文件：在没有 root 权限的情况下无法创建设备文件，而 Buildroot 有着不以 root 身份运行任何操作的原则。

> Buildroot 不允许 PATH 中有空格路径，需要暂时修改

### 运行所生成的系统

回到 `$HOME/embedded-linux-qemu-labs/buildroot/` 目录。创建一个名为 `nfsroot` 的新目录，用于存放我们的系统，并通过 NFS 导出。进入该目录，使用以下命令解压 `rootfs`：

```bash
tar xvf ../buildroot/output/images/rootfs.tar
```

将我们的 `nfsroot` 目录添加到 `/etc/exports` 中由 NFS 导出的目录列表里。

同时，从 Buildroot 在 `output/images/` 中编译出的文件更新你的开发板所使用的内核和设备树二进制文件。

启动开发板，并登录（root 账户，无密码）。

```bash
cd ~/embedded-linux-qemu-labs/buildroot/buildroot

qemu-system-arm -M vexpress-a9 -m 512M \
  -kernel output/images/zImage \
  -dtb output/images/vexpress-v2p-ca9.dtb \
  -drive file=output/images/rootfs.ext2,if=sd,format=raw \
  -append "root=/dev/mmcblk0 rw console=ttyAMA0" \
  -nographic
```

你现在应该能够进入一个 shell。

板内验证：

```bash
mpd --version
mpc version
ls -l /usr/bin/mpd /usr/bin/mpc
```

尽管目前我们还没有声音，但你可以运行 `speaker-test` 来检查这个应用程序是否正常工作。你也可以测试 `alsamixer` 命令。

通过运行 `ps` 命令，你还可以检查你的系统上是否启动了 mpd 服务器。不过，如前所述，我们不会尝试测试它，因为目前在 Ubuntu 22.04 上的 QEMU 中还没有声音。

### 分析依赖关系

理解我们所构建的软件包所描绘出的依赖关系总是很有用的。

首先我们需要安装 Graphviz：

```bash
sudo apt install graphviz
```

现在，让我们使用 Buildroot 的 target 来生成依赖关系图：

```bash
make graph-depends
```

我们现在可以查看依赖关系图：

```bash
evince output/graphs/graph-depends.pdf
```

特别是，你可以看到，添加 MPD 及其客户端需要为主机编译 Meson，进而还需要为主机编译 Python 3。这在很大程度上增加了构建时间。
