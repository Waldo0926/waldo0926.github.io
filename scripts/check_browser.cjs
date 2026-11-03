const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const baseURL = process.argv[2] || 'http://127.0.0.1:8877';
(async () => {
  const browser = await chromium.launch({headless:true, ...(process.env.PLAYWRIGHT_CHANNEL ? {channel:process.env.PLAYWRIGHT_CHANNEL} : {})});
  const page = await browser.newPage();
  const errors=[];
  page.on('pageerror', e=>errors.push(String(e)));
  for(const prefix of ['', '/zh']) {
    await page.goto(`${baseURL}${prefix}/`);
    assert.equal(await page.locator('a.project').filter({hasText:'SecureView'}).getAttribute('href'),'https://secureview.tech');
    for (const width of [1440, 1920, 390]) {
      await page.setViewportSize({width,height:1000});
      let expected;
      for (const route of ['about','projects','search','notes']) {
        const res=await page.goto(`${baseURL}${prefix}/${route}/`);
        assert.equal(res.status(),200,route);
        const box=await page.locator('.page-card').boundingBox();
        assert(box,route);
        if(expected) { assert(Math.abs(box.width-expected.width)<1,`width ${route}`); assert(Math.abs(box.x-expected.x)<1,`alignment ${route}`); }
        expected=box;
        assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`overflow ${route}`);
      }
    }
    await page.setViewportSize({width:1440,height:1000});
    await page.goto(`${baseURL}${prefix}/`);
    const links=await page.locator('.topic-card').evaluateAll(xs=>xs.map(x=>x.getAttribute('href')));
    assert.equal(links.length,6);
    for(const href of links) {
      const res=await page.request.get(new URL(href,baseURL).href);
      assert.equal(res.status(),200,href);
    }
    await page.goto(`${baseURL}${prefix}/projects/?keep=1#portfolio`);
    const values={q:'ｓｔｕｄｙ',category:'monash',tech:'Python',year:'2026',status:'current',ownership:'individual'};
    const ids={q:'search',category:'category',tech:'tech',year:'year',status:'status',ownership:'ownership'};
    for(const [key,value] of Object.entries(values)) {
      const input=page.locator(`#portfolio-${ids[key]}`);
      if(key==='q')await input.fill(value);else await input.selectOption(value);
    }
    await page.reload();
    for(const [key,value] of Object.entries(values))assert.equal(await page.locator(`#portfolio-${ids[key]}`).inputValue(),value);
    const visible=page.locator('.portfolio-card:visible');
    assert(await visible.count()>0);
    for(const card of await visible.all()) {
      const tech=JSON.parse(await card.getAttribute('data-tech'));assert(tech.includes('Python'));
    }
    const filteredCount = await visible.count();
    await page.locator('#portfolio-reset').click();
    assert.equal(new URL(page.url()).searchParams.get('keep'),'1');
    assert.equal(new URL(page.url()).searchParams.get('q'),null);
    assert.equal(await page.locator('.portfolio-card:visible').count(), await page.locator('.portfolio-card').count());
    assert(await page.locator('.portfolio-card:visible').count() > filteredCount);
    await page.locator('#portfolio-search').fill('no-such-project-987654');
    assert(await page.locator('#portfolio-empty').isVisible());
    await page.goto(`${baseURL}${prefix}/notes/`);
    assert(await page.locator('a[href*="study-kit-course-materials"]').count()>0);
    await page.setViewportSize({width:390,height:844});
    for(const path of ['/', '/projects/', '/notes/', '/2026/11/03/study-kit-course-materials'+(prefix?'-zh':'')+'/']) {
      const response=await page.goto(`${baseURL}${prefix && !path.startsWith('/2026')?prefix:''}${path}`);
      assert.equal(response.status(),200);
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`overflow ${prefix}${path}`);
    }
    await page.setViewportSize({width:1440,height:1000});
  }
  assert.deepEqual(errors,[]);
  console.log('Passed: bilingual six-direction links, technology/combined filters, NFKC search, URL persistence/reload/reset, article archive, mobile overflow and browser errors');
  await browser.close();
})().catch(e=>{console.error(e);process.exitCode=1});
