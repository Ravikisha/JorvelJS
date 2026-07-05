/**
 * Minimal ambient declarations for the tiny slice of Angular this adapter uses.
 * They let the package typecheck WITHOUT pulling the full @angular/* dependency
 * tree — Angular is a peer dependency provided by the remote app at build time.
 * The real types take over there.
 */

declare module '@angular/core' {
  export interface Type<T> {
    new (...args: never[]): T;
  }
  export interface EnvironmentInjector {
    _brand?: 'EnvironmentInjector';
  }
  export interface ViewRef {
    _brand?: 'ViewRef';
  }
  export interface ComponentRef<C> {
    instance: C;
    hostView: ViewRef;
    setInput(name: string, value: unknown): void;
    destroy(): void;
  }
  export interface ApplicationRef {
    injector: EnvironmentInjector;
    attachView(view: ViewRef): void;
    tick(): void;
    destroy(): void;
  }
  export function createComponent<C>(
    component: Type<C>,
    options: { environmentInjector: EnvironmentInjector; hostElement?: Element },
  ): ComponentRef<C>;
}

declare module '@angular/platform-browser' {
  import type { ApplicationRef, Type } from '@angular/core';
  export function createApplication(options?: {
    providers?: unknown[];
  }): Promise<ApplicationRef>;
  export function bootstrapApplication(
    rootComponent: Type<unknown>,
    options?: { providers?: unknown[] },
  ): Promise<ApplicationRef>;
}

declare module '@angular/platform-server' {
  import type { ApplicationRef } from '@angular/core';
  export function renderApplication(
    bootstrap: () => Promise<ApplicationRef>,
    options: { document?: string; url?: string },
  ): Promise<string>;
}
