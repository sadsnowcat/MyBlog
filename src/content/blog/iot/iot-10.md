---
title: "iot 学习笔记 10"
description: '应用程序开发'
date: "2026-09-25T04:07:48.460Z"
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

# iot 学习笔记 10

> 在目标机上编译并运行你自己的 ncurses 应用程序。

### 准备工作（Setup）

进入 `$HOME/embedded-linux-qemu-labs/appdev` 目录。

### 编译你自己的应用程序

我们将复用 Buildroot 实验中所构建的系统，并向其中加入我们自己的应用程序。

在实验目录下，文件 `app.c` 包含一个非常简单的 ncurses 应用程序。它是一个简单的游戏：你需要使用键盘的方向键抵达一个目标。我们将编译这个简单的应用程序，并将其集成到我们的 Linux 系统中。

Buildroot 已在 `output/host/bin` 中生成了工具链封装脚本（toolchain wrappers），它们使用起来更方便，因为这些封装脚本会传入一些必需的标志（特别是 `--sysroot` 这个 gcc 标志，它告诉 gcc 去哪里查找头文件和库）。

让我们把这个目录加入 `PATH`：

```bash
export PATH=$HOME/embedded-linux-qemu-labs/buildroot/buildroot/output/host/bin:$PATH
```

我们尝试编译这个应用程序：

```bash
arm-linux-gcc -o app app.c
```

它报错说某些符号存在未定义的引用。这很正常，因为我们没有告诉编译器去链接必要的库。因此，让我们使用 `pkg-config` 查询 pkg-config 数据库，以获取构建基于 ncurses 的应用程序所需的头文件位置以及库列表[^9]：

```bash
arm-linux-gcc -o app app.c $(pkg-config --libs --cflags ncurses)
```

我们的应用程序现在编译完成了！将生成的可执行文件复制到 NFS 根文件系统（例如复制到 `root/` 目录），启动你的系统，然后运行你的应用程序！

### 脚注

[^9]: 同样，`output/host/bin` 中包含一个特殊的 pkg-config，它能够自动知道去哪里查找，因此已经知晓查找 `.pc` 文件及其 sysroot 的正确路径。
