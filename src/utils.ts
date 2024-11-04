import { existsSync } from "fs";
import * as path from "path";

export function getPathNS(sourceFile:string,folders:string[]) {
    const levelUp = (dir:string) => {
        if ( dir === "/" ) {
            return null;
        }
        const defIdx = folders.indexOf(dir);

        if ( defIdx === -1 ) {
            const dotGit = path.join(dir,".git");
            const found = existsSync(dotGit);
            if ( found ) {
                const p = dir.split(path.sep);
                return p[p.length-1];
            }
        } else {
            const p = dir.split(path.sep);
            return p[p.length-1];
        }
        const parts = dir.split(path.sep);            
        if ( parts.length > 1 ) {                
            parts.pop();
            const prevPath = path.join(path.sep,...parts);
            return levelUp(prevPath);
        }
        return null;
    };
    
    const prs = path.parse(sourceFile);
    return levelUp(prs.dir);
}
