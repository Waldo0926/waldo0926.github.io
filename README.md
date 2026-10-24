# waldo0926.github.io

My blog, built by GitHub Pages with Jekyll. Layouts are in `_layouts/` and the only stylesheet is `assets/style.css`. Posts are in `_posts/`: one English and one Chinese file per post, sharing a `ref` so each links to the other. The English file can set `preview` to show an include from `_includes/preview/` on the home page card.

我的博客，用 GitHub Pages 自带的 Jekyll 生成。布局在 `_layouts/`，样式只有 `assets/style.css`。文章在 `_posts/`，每篇有英文和中文两个文件，用相同的 `ref` 互相链接。英文文件可以用 `preview` 指定 `_includes/preview/` 里的预览，显示在首页的文章卡片上。

Preview locally / 本地预览：

```sh
gem install jekyll jekyll-feed jekyll-seo-tag
jekyll serve
```
