/*
 * WHAT IS THIS FILE?
 *
 * It's the entry point for the SSR server.
 * 
 */
import {
  type RenderOptions,
  render,
} from '@builder.io/qwik/server';
import Root from './root';

export default function (opts: RenderOptions) {
  return render(<Root />, opts);
}
