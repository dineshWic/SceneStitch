/* global document, window, Event, fetch */
import { openBrowser } from '@remotion/renderer';
import process from 'node:process';
import console from 'node:console';
import { setTimeout } from 'node:timers';
const browser = await openBrowser('chrome', {
  browserExecutable: process.env.SCENESTITCH_BROWSER_EXECUTABLE,
});
const baseUrl = process.env.SCENESTITCH_TEST_URL ?? 'http://127.0.0.1:4000';
try {
  const page = await browser.newPage({
    context: () => null,
    logLevel: 'error',
    indent: false,
    pageIndex: 0,
    onBrowserLog: (log) => {
      if (log.type === 'error') console.error(log.text);
    },
    onLog: () => {},
  });
  await page.goto({ url: baseUrl, timeout: 30000 });
  const wait = async (predicate) => {
    const deadline = Date.now() + 15000;
    while (!(await page.evaluate(predicate))) {
      if (Date.now() > deadline) throw new Error('UI condition timed out');
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  };
  await wait(() => !!document.querySelector('.welcome button'));
  await page.evaluate(() => document.querySelector('.welcome button').click());
  await wait(() => !!document.querySelector('.editor'));
  await page.evaluate(() =>
    [...document.querySelectorAll('button')]
      .find((button) => button.textContent === '+ Scene')
      .click(),
  );
  await wait(() => document.querySelectorAll('tbody tr').length === 1);
  await page.evaluate(() =>
    [...document.querySelectorAll('button')]
      .find((button) => button.textContent === 'Import plan / table')
      .click(),
  );
  await wait(() => !!document.querySelector('textarea[aria-label="Production plan"]'));
  await page.evaluate(() => {
    const input = document.querySelector('textarea[aria-label="Production plan"]');
    Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set.call(
      input,
      'Time,Scene,Beat\n0-2,1,Hook\n2-4,2,Reveal',
    );
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.evaluate(() =>
    [...document.querySelectorAll('button')]
      .find((button) => button.textContent === 'Extract & review')
      .click(),
  );
  await wait(() => !!document.querySelector('textarea[aria-label="Review extracted scenes JSON"]'));
  await page.evaluate(() =>
    [...document.querySelectorAll('button')]
      .find((button) => button.textContent === 'Apply reviewed scenes')
      .click(),
  );
  await wait(() => document.querySelectorAll('tbody tr').length === 2);
  await wait(() => document.querySelector('.status')?.textContent === 'Saved');
  const result = await page.evaluate(() => ({
    rows: document.querySelectorAll('tbody tr').length,
    saved: document.querySelector('.status').textContent,
    errors: document.querySelector('[role="alert"]')?.textContent ?? null,
    title: document.title,
  }));
  if (result.errors) throw new Error(result.errors);
  const identity = await page.evaluate(async () => {
    const projectId = document.querySelector('select[aria-label="Open project"]').value;
    const response = await fetch(`/api/projects/${projectId}/render`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ draft: true }),
    });
    if (!response.ok) throw new Error('Unable to create export test');
    return { projectId, jobId: (await response.json()).id };
  });
  // Missing visuals should fail before rendering, and the diagnostic must survive a page reload.
  const deadline = Date.now() + 10000;
  while (true) {
    const response = await globalThis.fetch(`${baseUrl}/api/jobs/${identity.jobId}`);
    if ((await response.json()).status === 'failed') break;
    if (Date.now() > deadline) throw new Error('Invalid export did not fail promptly');
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  await page.goto({ url: baseUrl, timeout: 30000 });
  await wait(() => document.querySelector('select[aria-label="Open project"]').options.length > 1);
  await page.evaluate((projectId) => {
    const select = document.querySelector('select[aria-label="Open project"]');
    select.value = projectId;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }, identity.projectId);
  await wait(
    () => document.querySelector('select[aria-label="Previous exports"]')?.options.length > 1,
  );
  await page.evaluate((jobId) => {
    const select = document.querySelector('select[aria-label="Previous exports"]');
    select.value = jobId;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }, identity.jobId);
  await wait(() => !!document.querySelector('.export pre')?.textContent.includes('missing visual'));
  result.exportHistoryRecovered = true;
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close({ silent: true });
}
