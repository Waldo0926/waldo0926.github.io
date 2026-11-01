(() => {
  'use strict'
  const root = document.getElementById('portfolio')
  if (!root) return
  const search = document.getElementById('portfolio-search')
  const category = document.getElementById('portfolio-category')
  const year = document.getElementById('portfolio-year')
  const status = document.getElementById('portfolio-status')
  const ownership = document.getElementById('portfolio-ownership')
  const reset = document.getElementById('portfolio-reset')
  const output = document.getElementById('portfolio-count')
  const empty = document.getElementById('portfolio-empty')
  const cards = Array.from(root.querySelectorAll('.portfolio-card'))
  const isZh = document.documentElement.lang.toLowerCase().startsWith('zh')
  const match = (card, attribute, value) => !value || card.dataset[attribute] === value

  const initialCategory = new URLSearchParams(location.search).get('category')
  if (initialCategory && [...category.options].some(x => x.value === initialCategory)) category.value = initialCategory

  function update() {
    const query = search.value.normalize('NFKC').trim().toLocaleLowerCase()
    let count = 0
    cards.forEach(card => {
      const visible = (!query || card.dataset.search.normalize('NFKC').toLocaleLowerCase().includes(query))
        && match(card, 'category', category.value)
        && match(card, 'year', year.value)
        && match(card, 'status', status.value)
        && match(card, 'ownership', ownership.value)
      card.hidden = !visible
      if (visible) count++
    })
    output.textContent = isZh ? `显示${count}个项目，共${cards.length}个` : `Showing ${count} of ${cards.length} projects`
    empty.hidden = count !== 0
  }

  for (const control of [search, category, year, status, ownership]) {
    control.addEventListener(control === search ? 'input' : 'change', update)
  }
  reset.addEventListener('click', () => {
    search.value = category.value = year.value = status.value = ownership.value = ''
    history.replaceState(null, '', location.pathname + location.hash)
    update()
    search.focus()
  })
  update()
})()
