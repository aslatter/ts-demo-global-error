import * as ts from "typescript";
import * as fs from "fs";
import * as path from "path";

// We expect our demo-program to be in a sibling-folder called "input"
const projectPath = path.join(__dirname, "..", "..", "input");

function main() {
  const program = getProgram();
  const sourceFile = getSourceFile(program);

  const errors = ts.getPreEmitDiagnostics(program, sourceFile);
  if (errors.length) {
    console.log(
      ts.formatDiagnostics(errors, {
        getCanonicalFileName: str => path.resolve(str, projectPath),
        getNewLine: () => "\n",
        getCurrentDirectory: () => path.resolve(projectPath)
      })
    );
    process.exit(1);
  }

  // the second statement is the function-declaration we want
  const functionDecl = sourceFile.statements[1];
  if (!functionDecl || !ts.isFunctionDeclaration(functionDecl)) {
    exitError("Unable to find expect function-declaration in 'main.ts'");
    return; // unreachable
  }

  // The body should have two statements, each being an expression-statement.
  // The expressions should be call-expressions. We want the types of the LHS
  // of each

  const body = functionDecl.body;
  if (!body || body.statements.length < 2) {
    exitError("Unable to find expected body of function-declaration");
    return;
  }

  const checker = program.getTypeChecker();

  const firstType = getTypeForLHSOfCallStatement(checker, body.statements[0]);
  const secondType = getTypeForLHSOfCallStatement(checker, body.statements[1]);

  console.log(`First type: ${checker.typeToString(firstType, functionDecl)}`);
  console.log(`Second type: ${checker.typeToString(secondType, functionDecl)}`);
}

main();

/*** helper-functions ***/

function getProgram(): ts.Program {
  const configPath = path.join(projectPath, "tsconfig.json");

  if (!fs.existsSync(configPath)) {
    exitError(
      `Path at ${JSON.stringify(
        projectPath
      )} does not appear to be a TypeScript project`
    );
  }

  /*** Parse tsconfig.json ***/

  const fileConfigJson = ts.readJsonConfigFile(configPath, ts.sys.readFile);
  const parseConfigHost: ts.ParseConfigHost = {
    useCaseSensitiveFileNames: true,
    readDirectory: ts.sys.readDirectory,
    fileExists: ts.sys.fileExists,
    readFile: ts.sys.readFile
  };

  const parsedConfig:
    | ts.ParsedCommandLine
    | undefined = ts.parseJsonSourceFileConfigFileContent(
    fileConfigJson,
    parseConfigHost,
    path.resolve(projectPath),
    undefined
  );
  if (!parsedConfig) {
    exitError(`Unable to parse tsconfig file ${JSON.stringify(configPath)}`);
  }
  if (parsedConfig.errors.length) {
    console.log(`Errors parsing ${JSON.stringify(configPath)}`);
    console.log(
      ts.formatDiagnostics(parsedConfig.errors, {
        getCanonicalFileName: str => path.resolve(str, projectPath),
        getNewLine: () => "\n",
        getCurrentDirectory: () => path.resolve(projectPath)
      })
    );
    process.exit(1);
  }

  const inputFiles = parsedConfig.fileNames;
  const compilerOptions = parsedConfig.options;

  return ts.createProgram(inputFiles, compilerOptions);
}

function getSourceFile(program: ts.Program): ts.SourceFile {
  const sourceFile = program.getSourceFile(
    path.resolve(path.join(projectPath, "main.ts"))
  );
  if (!sourceFile) {
    exitError("Unable to get source-file 'main.ts'");
  }

  return sourceFile!;
}

function getTypeForLHSOfCallStatement(
  checker: ts.TypeChecker,
  statement: ts.Statement
): ts.Type {
  if (!ts.isExpressionStatement(statement)) {
    exitError(`Expected "${statement.getText()}" to be an call-expression`);
    return {} as any; // unreachable
  }

  const callExpression = statement.expression;
  if (!ts.isCallExpression(callExpression)) {
    exitError(
      `Expected "${callExpression.getText()}" to be an call-expression`
    );
    return {} as any; // unreachable
  }

  return checker.getTypeAtLocation(callExpression.expression);
}

function exitError(message: string): never {
  console.log(`Error - ${message}`);
  process.exit(1);
  // unreachable
  while (true) {}
}
