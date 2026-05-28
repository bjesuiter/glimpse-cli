#!/usr/bin/env node
import { serve } from './ipc/server.ts';
import { dispatch } from './daemon/daemon.ts';
serve(dispatch);
