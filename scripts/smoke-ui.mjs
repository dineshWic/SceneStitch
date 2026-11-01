/* global document, window, Event */
import { openBrowser } from '@remotion/renderer';
import process from 'node:process';
import console from 'node:console';
import { setTimeout } from 'node:timers';
const browser = await openBrowser('chrome', {
  browserExecutable: process.env.SCENESTITCH_BROWSER_EXECUTABLE,
});
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
  await page.goto({ url: 'http://127.0.0.1:4000', timeout: 30000 });
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
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close({ silent: true });
}
