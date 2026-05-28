#!/usr/bin/env bun
import { serve } from './ipc/server.ts';
import { dispatch } from './daemon/daemon.ts';
serve(dispatch);
