import { readFile, writeFile } from 'node:fs/promises';

// Emscripten's embind runtime generates JavaScript with new Function. Chrome MV3
// disallows unsafe-eval even when wasm-unsafe-eval is present. Replace just the
// two generators with equivalent closures in the copied runtime (not upstream
// assets used by non-extension starters). Fail the build if Moonshine changes.
const path = new URL('../dist/transcription-assets/moonshine/moonshine.mjs', import.meta.url);
let runtime = await readFile(path, 'utf8');
const replaceOnce = (source, replacement) => {
  if (runtime.split(source).length !== 2)
    throw new Error(`Unexpected Moonshine runtime: ${source}`);
  runtime = runtime.replace(source, replacement);
};

replaceOnce(
  'var invokerFn=new Function(...args,invokerFnBody)(...closureArgs);',
  `var invokerFn=function(...callArgs){
    if(callArgs.length!==argCount-2) throwBindingError('Function '+humanName+' called with '+callArgs.length+' arguments');
    var destructors=needsDestructorStack?[]:null;
    var wired=[];
    if(isClassMethodFunc) wired.push(argTypes[1].toWireType(destructors,this));
    for(var i=0;i<callArgs.length;i++) wired.push(argTypes[i+2].toWireType(destructors,callArgs[i]));
    var rv=cppInvokerFunc(cppTargetFunc,...wired);
    if(needsDestructorStack) runDestructors(destructors);
    else for(var i=isClassMethodFunc?1:2;i<argTypes.length;i++){
      var destructor=argTypes[i].destructorFunction;
      if(destructor!==null) destructor(wired[i-(isClassMethodFunc?1:2)]);
    }
    if(returns) return argTypes[0].fromWireType(rv);
  };`
);
replaceOnce(
  'var invokerFunction=new Function(...params,functionBody)(...args);',
  `var invokerFunction=function(obj,func,destructorsRef,values){
    var read=[];var offset=0;
    for(var i=0;i<types.length;i++){
      read.push(types[i].readValueFromPointer(values+offset));
      offset+=types[i].argPackAdvance;
    }
    var rv=kind===1?Reflect.construct(func,read):kind===0?func.call(obj,...read):func.call(...read);
    if(!retType.isVoid) return emval_returnValue(retType,destructorsRef,rv);
  };`
);
if (/new Function\s*\(/.test(runtime))
  throw new Error('Moonshine still uses dynamic code generation.');
await writeFile(path, runtime);
