---
layout: post
project: AI & Data
description: "My earlier CNN exercises are organized in [tensorflow-cnn-image-classification](https://github.com/Waldo0926/tensorflow-cnn-image-classification): CIFAR-10, MNIST, TensorFlow/Keras model presets, confusion matrices and per-class metrics."
ref: cnn-reproducibility
lang: en
title: "What I check before comparing my old CNN experiments"
image: /assets/og/site.png
---

> Editorial draft: verify facts and references before publication. Not published on the site.

My earlier CNN exercises are organized in [tensorflow-cnn-image-classification](https://github.com/Waldo0926/tensorflow-cnn-image-classification): CIFAR-10, MNIST, TensorFlow/Keras model presets, confusion matrices and per-class metrics.

Before comparing scores, I want to inspect the train/validation/test split, random seeds and recorded configuration. A leaderboard without these details can be hard to reproduce.

Using the test set to choose hyperparameters contaminates the final evaluation. Macro precision, recall and F1 add context to accuracy, while wrong predictions can reveal systematic errors.

I still need a clean run before reporting timings, environment versions or benchmark figures. This draft deliberately includes no unverified accuracy claims.
