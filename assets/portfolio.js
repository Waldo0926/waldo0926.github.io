(() => {
  'use strict'
  const root = document.getElementById('portfolio')
  if (!root) return
  const search = document.getElementById('portfolio-search')
  const category = document.getElementById('portfolio-category')
  const tech = document.getElementById('portfolio-tech')
  const year = document.getElementById('portfolio-year')
  const status = document.getElementById('portfolio-status')
  const ownership = document.getElementById('portfolio-ownership')
  const reset = document.getElementById('portfolio-reset')
  const output = document.getElementById('portfolio-count')
  const empty = document.getElementById('portfolio-empty')
  const cards = Array.from(root.querySelectorAll('.portfolio-card'))
  const isZh = document.documentElement.lang.toLowerCase().startsWith('zh')
  const match = (card, attribute, value) => !value || card.dataset[attribute] === value

  const controls = { q: search, category, tech, year, status, ownership }
  const params = new URLSearchParams(location.search)
  for (const [key, control] of Object.entries(controls)) {
    const value = params.get(key)
    if (value && (control === search || [...control.options].some(x => x.value === value))) control.value = value
  }

  function saveFilters() {
    const url = new URL(location.href)
    for (const [key, control] of Object.entries(controls)) {
      if (control.value) url.searchParams.set(key, control.value)
      else url.searchParams.delete(key)
    }
    history.replaceState(null, '', url.pathname + url.search + url.hash)
  }

  function update() {
    const query = search.value.normalize('NFKC').trim().toLocaleLowerCase()
    let count = 0
    cards.forEach(card => {
      const visible = (!query || card.dataset.search.normalize('NFKC').toLocaleLowerCase().includes(query))
        && (!tech.value || JSON.parse(card.dataset.tech).includes(tech.value))
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

  for (const control of Object.values(controls)) {
    control.addEventListener(control === search ? 'input' : 'change', () => { update(); saveFilters() })
  }
  reset.addEventListener('click', () => {
    for (const control of Object.values(controls)) control.value = ''
    saveFilters()
    update()
    search.focus()
  })
  update()
})()
