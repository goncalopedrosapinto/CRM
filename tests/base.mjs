// Base de ensaio: Postgres 17 em memória (PGlite) com o esquema real de produção, sem dados.
// Aplica sql/base/*, depois todas as migrações por ordem, e repete as pendentes para provar que podem correr duas vezes.
import {PGlite} from '@electric-sql/pglite';
import fs from 'fs';import path from 'path';import {fileURLToPath} from 'url';
const RAIZ=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export async function baseDeEnsaio({log=()=>{}}={}){
  const db=new PGlite();
  for(const f of fs.readdirSync(path.join(RAIZ,'sql/base')).sort()){
    try{await db.exec(fs.readFileSync(path.join(RAIZ,'sql/base',f),'utf8'));}catch(e){throw new Error('base/'+f+': '+e.message);}
    log('base '+f);
  }
  const aplicadas=new Set(fs.readFileSync(path.join(RAIZ,'sql/APLICADAS.txt'),'utf8').split('\n').map(s=>s.trim()).filter(s=>s&&!s.startsWith('#')));
  const migs=fs.readdirSync(path.join(RAIZ,'sql/migracoes')).filter(f=>f.endsWith('.sql')).sort();
  const pendentes=process.env.SEM_PENDENTES?[]:migs.filter(f=>!aplicadas.has(f));
  const correr=process.env.SEM_PENDENTES?migs.filter(f=>aplicadas.has(f)):migs;
  for(const f of correr){
    try{await db.exec(fs.readFileSync(path.join(RAIZ,'sql/migracoes',f),'utf8'));}catch(e){throw new Error('migração '+f+': '+e.message);}
    log((aplicadas.has(f)?'reaplicada ':'pendente   ')+f);
  }
  for(const f of pendentes){
    try{await db.exec(fs.readFileSync(path.join(RAIZ,'sql/migracoes',f),'utf8'));}catch(e){throw new Error('migração '+f+' não pode correr duas vezes: '+e.message);}
  }
  return {db,pendentes};
}
