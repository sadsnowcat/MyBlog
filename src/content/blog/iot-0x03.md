---
title: "IoT 学习笔记 0x03"
description: "获取 Linux 内核源码"
date: "2026-08-29T10:34:19.446Z"
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

# IoT 学习笔记 0x03

> 如何从 git 获取 Linux 内核源码，包括 master 分支与稳定分支。

创建 `$HOME/embedded-linux-qemu-labs/kernel` 目录并进入该目录。

要开始使用 Linux 内核源码，我们需要克隆其参考 git 树，即由 Linus Torvalds 维护的那个。


```bash
git clone https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux
cd linux
```

请耐心等待。

Linus Torvalds 的 Linux 内核仓库包含了 Linux 的所有主要发布版本，但不包含稳定版本：它们由一个独立的团队维护，并托管在一个独立的仓库中。

我们将把这个独立的仓库作为另一个 remote 添加进来，以便能够使用稳定版本：

```bash
git remote add stable https://git.kernel.org/pub/scm/linux/kernel/git/stable/linux
git fetch stable
```

你可以通过运行以下命令进行确认：

```bash
git branch -a
```

我们将在接下来的实验中选定一个特定的稳定版本。接下来，可以交叉编译一个内核了。
