---
layout: post
project: AI & Data
description: "以前的CNN实验现在整理在[tensorflow-cnn-image-classification](https://github.com/Waldo0926/tensorflow-cnn-image-classification)。仓库涉及CIFAR-10、MNIST、TensorFlow/Keras、模型配置、混淆矩阵和按类别的指标。"
ref: cnn-reproducibility
lang: zh-Hans
title: "重看CNN实验时，我想先确认的不是准确率"
image: /assets/og/site.png
---

> 编辑草稿：事实与引用尚待复核，未在网站发布

以前的CNN实验现在整理在[tensorflow-cnn-image-classification](https://github.com/Waldo0926/tensorflow-cnn-image-classification)。仓库涉及CIFAR-10、MNIST、TensorFlow/Keras、模型配置、混淆矩阵和按类别的指标。

我想比较模型之前，会先检查训练、验证与测试数据是不是分开了，随机种子与参数有没有记录，以及同一次实验里的模型是否使用相同的数据切分。只看一张准确率表，很容易忽略结果是否可复现。

如果测试集被用来挑模型，最终的分数就不再是独立评估。宏平均Precision、Recall和F1可以补充准确率的不足，错误样例也有助于理解模型到底错在哪里。

这篇需要补做一次干净环境的运行，再填真实训练耗时、版本和结果。因此先保留草稿，不写“达到了多少准确率”这种未经重新验证的结论。
