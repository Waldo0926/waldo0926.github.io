(() => {
  'use strict'
  const box = document.getElementById('blog-search')
  if (!box) return
  const input = document.getElementById('blog-search-input')
  const results = document.getElementById('blog-search-results')
  const count = document.getElementById('blog-search-count')
  const error = document.getElementById('blog-search-error')
  const lang = box.dataset.lang
  const zh = lang === 'zh-Hans'
  const norm = value => String(value || '').normalize('NFKC').toLocaleLowerCase()
  let posts = []
  let ready = false
  let requested = false

  function render() {
    results.replaceChildren()
    if (!ready) return
    const q = norm(input.value).trim().split(/\\s+/).filter(Boolean)
    if (!q.length) {
      count.textContent = zh ? '输入关键词开始搜索' : 'Type to search'
      return
    }
    const matches = posts.filter(post => {
      const haystack = norm([post.title, post.description, post.project, post.content].join(' '))
      return q.every(term => haystack.includes(term))
    }).slice(0, 60)
    count.textContent = zh ? `找到${matches.length}篇文章${matches.length === 60 ? '（最多显示60篇）' : ''}` : `${matches.length} matching posts${matches.length === 60 ? ' (showing first 60)' : ''}`
    for (const post of matches) {
      const li = document.createElement('li')
      const title = document.createElement('a')
      title.href = post.url
      title.textContent = post.title
      const meta = document.createElement('span')
      meta.textContent = `${post.date} · ${post.project}`
      const description = document.createElement('p')
      description.textContent = post.description
      li.append(title, meta, description)
      results.appendChild(li)
    }
  }

  async function load() {
    if (requested) return
    requested = true
    try {
      const response = await fetch('/search-index.json', { cache: 'no-cache' })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = await response.json()
      posts = data.filter(post => post.lang === lang)
      ready = true
      error.hidden = true
      render()
    } catch {
      error.hidden = false
      count.textContent = zh ? '搜索暂时不可用' : 'Search temporarily unavailable'
    }
  }

  input.addEventListener('input', () => { if (!requested) load(); else render() })
  const q = new URLSearchParams(location.search).get('q')
  if (q) input.value = q
  load()
})()
