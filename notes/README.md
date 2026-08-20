# 统计方法讲义（bookdown 子站）

个人主页配套的统计讲义，由 [bookdown](https://bookdown.org/yihui/bookdown/)
渲染为 GitBook 风格静态站点。访问入口：主页导航「讲义」→ `notes/_book/`。

## 目录结构

- `index.Rmd`：书名页与前言（YAML 头配置书名、作者、参考文献）。
- `0*.Rmd`：章节文件，按文件名排序即章节顺序。
- `_bookdown.yml`：构建配置（输出目录、语言标签）。
- `_output.yml`：输出格式配置（gitbook 主题、目录、分享）。
- `style.css`：自定义样式（深蓝主题，贴近主页）。
- `book.bib`：BibTeX 参考文献。
- `_book/`：渲染产物（已提交，GitHub Pages 直接服务）。

## 本地渲染

需要 R（≥ 3.5）与 pandoc。推荐直接使用本机 Quarto 自带的 pandoc：

```powershell
$env:PATH = "E:\Dev\Apps\Quarto\bin\tools;" + $env:PATH
cd notes
Rscript -e "install.packages('bookdown', repos='https://cloud.r-project.org')"  # 首次
Rscript -e "bookdown::render_book('index.Rmd')"
```

产物输出到 `notes/_book/`，可用任意静态服务器预览：

```powershell
cd notes\_book
python -m http.server 8000   # http://localhost:8000
```

> **缓存注意**：若曾修改章节结构或出现 TOC 链接异常（如指向错误的
> 章节文件），先删除渲染缓存再重建：
>
> ```powershell
> cd notes
> Remove-Item -Recurse -Force _bookdown_files, notes-book_files
> Rscript -e "bookdown::render_book('index.Rmd')"
> ```
>
> 正式产物以 CI 渲染为准（workflow 在推送后自动渲染提交，环境无
> 缓存，产物最稳定）。

## 写作约定（重要）

1. **定理环境用 fenced Div，不用 `\begin{theorem}`**：
   pandoc 3.x 移除了 `fancy_latex` 扩展，bookdown 0.47 的
   `custom-environment.lua` 只处理被 pandoc 解析为 Div 的环境；
   LaTeX 风格的 `\begin{theorem}` 在 pandoc 3 下会被整体丢弃。
   正确写法：

   ```markdown
   ::: {.theorem #saddle name="Daniels 鞍点逼近"}
   定理内容（Markdown 语法）……
   :::
   ```

   id 只写 `#saddle`（不要写 `#thm:saddle`，bookdown 会自动加 `thm:` 前缀），
   引用仍用 `\@ref(thm:saddle)`。

2. **定理环境内部不要嵌套编号公式**（`(\#eq:...)` 在定理内会失效），
   把编号公式放在定理环境之外。

3. **编号公式**用 `\begin{equation} ... (\#eq:label) \end{equation}`，
   引用用 `\@ref(eq:label)`。

4. **代码块**：需要在渲染时执行的 R 代码用 ```{r label}```，
   只展示不执行的用 `eval=FALSE`。避免依赖未安装的包；示例只使用
   基础 R 或 R 推荐包（如 `nlme`）。

## 自动构建

`.github/workflows/build-bookdown-notes.yml` 在 `notes/**` 变更时自动
渲染并提交 `_book/` 产物（与 `auto-sync-generated.yml` 模式一致），
推送后 GitHub Pages 自动生效。

## 新增章节

1. 新建 `04-my-chapter.Rmd`（编号继续递增）；
2. 在 `index.Rmd` 前言补一句说明（可选）；
3. 本地渲染检查无警告后提交。
