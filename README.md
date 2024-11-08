# SharedLock - File Modification Guard

#### Used to acquire ownership of file(s) inside common to all team members project 

## Installation

Install from vscode marketplace [SharedLock](https://marketplace.visualstudio.com/items?itemName=code4bones.sharedlock).

## Setup

    1. Open extension settings and setup common redis connection params
    2. Each team member need to set identical redis instance, and DB number


## Demos

![Demo](./resources/images/demo.gif)


![UnlockRequest](./resources/images/unlockreq.gif)

## Screens 

![Release](./resources/images/sharedlock_exp.png)

![Release](./resources/images/release.png)

![Release](./resources/images/folderlock.png)

## How it works

For preventing merge confilicts while editing same file, developer can lock the file, so other team members
cannot edit it, until first developer releases the file

This works inside identical project source tree ( i.e. cloned repo of same project, but doesn't care abount branch),
Locks works on [Workspace]/**/* files.


