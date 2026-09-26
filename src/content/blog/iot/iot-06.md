---
title: "IoT 学习笔记 06"
description: "访问硬件设备"
date: "2026-09-13T01:20:00.000Z"
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

# IoT 学习笔记 0x06

> 既然已经通过可用的根文件系统拿到了命令行 shell，就可以探索板子上的已有设备了。
>
> 本系列大部分为文档的翻译。**本实验在模拟平台（QEMU）上进行，不是真实硬件，部分设备属性与文档描述有差异。**

参考资料： [嵌入式 Linux 与内核工程](https://bootlin.com/doc/training/embedded-linux/)

进入 `$HOME/embedded-linux-qemu-labs/hardware` 目录（本实验所需的实用文件在此）。我们仍通过 NFS 启动系统，复用第 5 章构建的根文件系统。

## 探索 `/dev`

在目标机（板子 shell）上探索 `/dev`，会看到几类值得注意的设备文件：

- **终端设备**：以 `tty` 开头。终端是以文本为输入、文本为输出的用户界面，通常由交互式 shell 使用。你会找到 `console`（对应内核命令行 `console=` 指定的设备）和 `ttyAMA0`。
- **伪终端设备**：以 `pty` 开头，例如 SSH 连接时用的。它们是虚拟设备。
- **MMC 设备及其分区**：以 `mmcblk` 开头。能从中识别出 SD 卡（`mmcblk0`）及其分区（`mmcblk0p1/p2/p3`）。

也可以在开发工作站上探索 `/dev` 作对比。

## 探索 `/sys`

Sysfs 把内核的设备模型暴露给用户空间，结构比 `/proc` 更规整。一个很好的起点是 `/sys/class`，它按内核框架对设备分类。

### `/sys/class/net`：网络接口属性

进入 `/sys/class/net`，会列出系统上所有网络接口（内部、外部、虚拟都算）：

```sh
# cd /sys/class/net
# ls
eth0  lo
```

找到与到宿主机连接对应的 `eth0` 子目录，查看设备属性。这些属性都是**文本文件**，直接 `cat` 即可，无需复杂命令：

| 属性 | 含义 |
|---|---|
| `address` | 设备的 MAC 地址 |
| `speed` | 链路速率（Mbps），千兆/百兆 |
| `operstate` | 接口状态（`up`/`down`） |
| `statistics/rx_bytes` | 该接口接收的字节数 |

实测（QEMU 虚拟网卡）：

```sh
# cat eth0/address
52:54:00:12:34:56
# cat eth0/operstate
up
# cat eth0/statistics/rx_bytes
421836
```

### `/sys/class/thermal`：温度

检查 `/sys/class/thermal` 是否存在且非空——那是温控框架，可读取系统温度传感器的温度。在 QEMU 模拟的 Cortex-A9 上一般没有真实传感器，该目录可能为空或不存在。

### `/sys/bus`：总线与设备

查看 `/sys/bus` 可探索系统上所有可用总线（虚拟或物理）。进入 `/sys/bus/mmc/devices` 看所有 MMC 设备，再进第一个设备目录，能看到：

- `serial`：设备序列号
- `preferred_erase_size`：首选擦除块大小（分区建议从其整数倍处开始）
- `name`：产品名
- `date`：看起来是制造日期
