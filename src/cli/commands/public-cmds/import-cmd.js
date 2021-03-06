/** @flow */
import R from 'ramda';
import chalk from 'chalk';
import Command from '../../command';
import { importAction } from '../../../api/consumer';
import { immutableUnshift } from '../../../utils';
import { formatPlainComponentItem, formatPlainComponentItemWithVersions } from '../../chalk-box';
import Component from '../../../consumer/component';
import { ComponentWithDependencies } from '../../../scope';
import type { ImportOptions, ImportDetails } from '../../../consumer/component/import-components';
import type { EnvironmentOptions } from '../../../api/consumer/lib/import';
import GeneralError from '../../../error/general-error';
import { BASE_DOCS_DOMAIN } from '../../../constants';

export default class Import extends Command {
  name = 'import [ids...]';
  description = `import components into your current workspace.\n  https://${BASE_DOCS_DOMAIN}/docs/importing-components.html`;
  alias = 'i';
  opts = [
    ['t', 'tester', 'import a tester environment component'],
    ['c', 'compiler', 'import a compiler environment component'],
    ['', 'extension', 'import an extension component'],
    ['e', 'environment', 'install development environment dependencies (compiler and tester)'],
    ['p', 'path <path>', 'import components into a specific directory'],
    [
      'o',
      'objects',
      "import components objects only, don't write the components to the file system. This is a default behavior for import with no id"
    ],
    ['', 'write', 'in case of import-all (when no id is specified), write the components to the file system'],
    ['d', 'display-dependencies', 'display the imported dependencies'],
    ['O', 'override', 'override local changes'],
    ['v', 'verbose', 'showing verbose output for inspection'],
    ['', 'ignore-dist', 'write dist files (when exist) to the configured directory'],
    ['', 'conf', 'write the configuration file (bit.json)'],
    [
      '',
      'skip-npm-install',
      'do not install packages of the imported components. (it automatically enables save-dependencies-as-components flag)'
    ],
    [
      '',
      'ignore-package-json',
      'do not generate package.json for the imported component(s). (it automatically enables skip-npm-install and save-dependencies-as-components flags)'
    ]
  ];
  loader = true;
  migration = true;

  action(
    [ids]: [string[]],
    {
      tester = false,
      compiler = false,
      extension = false,
      path,
      objects = false,
      write = false,
      displayDependencies = false,
      environment = false,
      override = false,
      verbose = false,
      ignoreDist = false,
      conf = false,
      skipNpmInstall = false,
      ignorePackageJson = false
    }: {
      tester?: boolean,
      compiler?: boolean,
      extension?: boolean,
      path?: string,
      objects?: boolean,
      write?: boolean,
      displayDependencies?: boolean,
      environment?: boolean,
      override?: boolean,
      verbose?: boolean,
      ignoreDist?: boolean,
      conf?: boolean,
      skipNpmInstall?: boolean,
      ignorePackageJson?: boolean
    },
    packageManagerArgs: string[]
  ): Promise<any> {
    if (tester && compiler) {
      throw new GeneralError('you cant use tester and compiler flags combined');
    }
    if (objects && write) {
      throw new GeneralError('you cant use --objects and --write flags combined');
    }
    if (ids.length && write) {
      throw new GeneralError('you cant use --write flag when importing specific ids');
    }
    const environmentOptions: EnvironmentOptions = {
      tester,
      compiler,
      extension
    };

    const importOptions: ImportOptions = {
      ids,
      verbose,
      writeToPath: path,
      objectsOnly: objects,
      writeToFs: write,
      withEnvironments: environment,
      override,
      writeDists: !ignoreDist,
      writeBitJson: conf,
      installNpmPackages: !skipNpmInstall,
      writePackageJson: !ignorePackageJson
    };
    return importAction(environmentOptions, importOptions, packageManagerArgs).then(importResults =>
      R.assoc('displayDependencies', displayDependencies, importResults)
    );
  }

  report({
    dependencies,
    envDependencies,
    importDetails,
    warnings,
    displayDependencies
  }: {
    dependencies?: ComponentWithDependencies[],
    envDependencies?: Component[],
    importDetails: ImportDetails[],
    warnings?: {
      notInPackageJson: [],
      notInNodeModules: [],
      notInBoth: []
    },
    displayDependencies?: boolean
  }): string {
    let dependenciesOutput;
    let envDependenciesOutput;

    if (dependencies && !R.isEmpty(dependencies)) {
      const components = dependencies.map(R.prop('component'));
      const peerDependencies = R.flatten(
        dependencies.map(R.prop('dependencies')),
        dependencies.map(R.prop('devDependencies'))
      );

      const title =
        components.length === 1
          ? 'successfully imported one component'
          : `successfully imported ${components.length} components`;
      const componentDependencies = components.map((component) => {
        const details = importDetails.find(c => c.id === component.id.toStringWithoutVersion());
        if (!details) throw new Error(`missing details of component ${component.id.toString()}`);
        return formatPlainComponentItemWithVersions(component, details);
      });
      const componentDependenciesOutput = [chalk.green(title)].concat(componentDependencies).join('\n');

      const peerDependenciesOutput =
        peerDependencies && !R.isEmpty(peerDependencies) && displayDependencies
          ? immutableUnshift(
            R.uniq(peerDependencies.map(formatPlainComponentItem)),
            chalk.green(`\n\nsuccessfully imported ${components.length} component dependencies`)
          ).join('\n')
          : '';

      dependenciesOutput = componentDependenciesOutput + peerDependenciesOutput;
    }

    if (envDependencies && !R.isEmpty(envDependencies)) {
      envDependenciesOutput = immutableUnshift(
        envDependencies.map(envDependency => formatPlainComponentItem(envDependency.component)),
        chalk.green('the following component environments were installed')
      ).join('\n');
    }

    const getImportOutput = () => {
      if (dependenciesOutput && !envDependenciesOutput) return dependenciesOutput;
      if (!dependenciesOutput && envDependenciesOutput) return envDependenciesOutput;
      if (dependenciesOutput && envDependenciesOutput) {
        return `${dependenciesOutput}\n\n${envDependenciesOutput}`;
      }

      return chalk.yellow('nothing to import');
    };

    const logObject = obj => `> ${R.keys(obj)[0]}: ${R.values(obj)[0]}`;
    const getWarningOutput = () => {
      if (!warnings) return '';
      let output = '\n';

      if (!R.isEmpty(warnings.notInBoth)) {
        output += chalk.red.underline(
          '\nerror - missing the following package dependencies. please install and add to package.json.\n'
        );
        output += chalk.red(`${warnings.notInBoth.map(logObject).join('\n')}\n`);
      }

      if (!R.isEmpty(warnings.notInPackageJson)) {
        output += chalk.yellow.underline('\nwarning - add the following packages to package.json\n');
        output += chalk.yellow(`${warnings.notInPackageJson.map(logObject).join('\n')}\n`);
      }

      if (!R.isEmpty(warnings.notInNodeModules)) {
        output += chalk.yellow.underline('\nwarning - following packages are not installed. please install them.\n');
        output += chalk.yellow(`${warnings.notInNodeModules.map(logObject).join('\n')}\n`);
      }

      return output === '\n' ? '' : output;
    };

    return getImportOutput() + getWarningOutput();
  }
}
