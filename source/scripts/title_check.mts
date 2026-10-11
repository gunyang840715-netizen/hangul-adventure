import assert from 'node:assert/strict';
import { appTitle } from '../src/lib/appTitle';
for (const value of [undefined, null, '', '  ', '친구', ' 친구 ']) assert.equal(appTitle(value), '한글나라');
assert.equal(appTitle(' 테스트 '), '테스트 한글나라');
console.log('App title checks passed');
