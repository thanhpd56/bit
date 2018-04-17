import path from 'path';
import { expect } from 'chai';
import Helper from '../e2e-helper';

describe('bit import command with no ids', function () {
  this.timeout(0);
  const helper = new Helper();
  after(() => {
    helper.destroyEnv();
  });
  describe('with a component in bit.json', () => {
    before(() => {
      helper.setNewLocalAndRemoteScopes();
      // export a new component "bar/foo"
      helper.createComponentBarFoo();
      helper.addComponentBarFoo();
      helper.commitComponentBarFoo();
      helper.exportComponent('bar/foo');
      helper.reInitLocalScope();
      helper.addRemoteScope();
      // add "foo" as a bit.json dependency
      const bitJsonPath = path.join(helper.localScopePath, 'bit.json');
      helper.addBitJsonDependencies(bitJsonPath, { [`${helper.remoteScope}/bar/foo`]: '0.0.1' });
    });
    it('should display a successful message with the list of installed components', () => {
      const output = helper.importAllComponents(true);
      expect(output.includes('successfully imported one component')).to.be.true;
    });
  });
  describe('with a component in bit.map', () => {
    before(() => {
      helper.setNewLocalAndRemoteScopes();
      helper.createComponentBarFoo();
      helper.addComponentBarFoo();
      helper.commitComponentBarFoo();
      helper.exportComponent('bar/foo');
      const bitMap = helper.readBitMap();
      helper.reInitLocalScope();
      helper.addRemoteScope();
      helper.writeBitMap(bitMap);
    });
    it('should display a successful message with the list of installed components', () => {
      const output = helper.importAllComponents(true);
      expect(output.includes('successfully imported one component')).to.be.true;
    });
  });

  describe('with components in both bit.map and bit.json when they are modified locally', () => {
    before(() => {
      helper.setNewLocalAndRemoteScopes();
      helper.createComponentBarFoo();
      helper.addComponentBarFoo();
      helper.commitComponentBarFoo();
      helper.exportComponent('bar/foo');
      const bitMap = helper.readBitMap();
      helper.createFile('bar', 'foo2.js');
      helper.addComponent('bar/foo2.js');
      helper.commitAllComponents();
      helper.exportAllComponents();
      helper.reInitLocalScope();
      helper.addRemoteScope();
      helper.writeBitMap(bitMap);
      const bitJsonPath = path.join(helper.localScopePath, 'bit.json');
      helper.addBitJsonDependencies(bitJsonPath, { [`${helper.remoteScope}/bar/foo2`]: '0.0.1' });
      helper.importAllComponents(true);
      const barFooFixtureV2 = "module.exports = function foo() { return 'got foo v2'; };";
      helper.createFile('bar', 'foo.js', barFooFixtureV2);
      helper.createFile(path.join('components', 'bar', 'foo2'), 'foo2.js', barFooFixtureV2);
    });
    describe('without --override flag', () => {
      let output;
      before(() => {
        try {
          helper.importAllComponents(true);
        } catch (err) {
          output = err.toString();
        }
      });
      it('should display a warning saying it was unable to import', () => {
        expect(output).to.have.string('unable to import');
        expect(output).to.have.string('bar/foo');
        expect(output).to.have.string('bar/foo2');
      });
    });
    describe('with --override flag', () => {
      let output;
      before(() => {
        output = helper.runCmd('bit import --override');
      });
      it('should display a successful message', () => {
        expect(output).to.have.string('successfully imported');
        expect(output).to.have.string('bar/foo');
        expect(output).to.have.string('bar/foo2');
      });
    });
  });

  describe('with an AUTHORED component which was only committed but not exported', () => {
    before(() => {
      helper.setNewLocalAndRemoteScopes();
      helper.createComponentBarFoo();
      helper.addComponentBarFoo();
      helper.commitComponentBarFoo();
      const bitMap = helper.readBitMap();
      helper.reInitLocalScope();
      helper.addRemoteScope();
      helper.writeBitMap(bitMap);
    });
    it('should not try to import that component as it was not exported yet', () => {
      try {
        helper.importAllComponents(true);
      } catch (err) {
        expect(err.toString()).to.have.string('nothing to import');
      }
    });
  });
});
