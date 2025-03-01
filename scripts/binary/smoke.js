const _ = require('lodash')
const fse = require('fs-extra')
const cp = require('child_process')
const execa = require('execa')
const path = require('path')
const Promise = require('bluebird')
const os = require('os')
const verify = require('../../cli/lib/tasks/verify')
const Fixtures = require('@tooling/system-tests')
const { scaffoldCommonNodeModules } = require('@tooling/system-tests/lib/dep-installer')

const fs = Promise.promisifyAll(fse)

const canRecordVideo = () => {
  return os.platform() !== 'win32'
}

const shouldSkipProjectTest = () => {
  return os.platform() === 'win32'
}

const runSmokeTest = function (buildAppExecutable, timeoutSeconds = 30) {
  const rand = String(_.random(0, 1000))

  console.log(`executable path ${buildAppExecutable}`)
  console.log(`timeout ${timeoutSeconds} seconds`)

  const hasRightResponse = function (stdout) {
    // there could be more debug lines in the output, so find 1 line with
    // expected random value
    const lines = stdout.split('\n').map((s) => {
      return s.trim()
    })

    return lines.includes(rand)
  }

  const args = []

  if (verify.needsSandbox()) {
    args.push('--no-sandbox')
  }

  // separate any Electron command line arguments from Cypress args
  args.push('--')
  args.push('--smoke-test')
  args.push(`--ping=${rand}`)

  const options = {
    timeout: timeoutSeconds * 1000,
  }

  return execa(`${buildAppExecutable}`, args, options)
  .catch((err) => {
    console.error('smoke test failed with error %s', err.message)
    throw err
  }).then(({ stdout }) => {
    stdout = stdout.replace(/\s/, '')
    if (!hasRightResponse(stdout)) {
      throw new Error(`Stdout: '${stdout}' did not match the random number: '${rand}'`)
    }

    console.log('smoke test response', stdout)

    return console.log('smokeTest passes')
  })
}

const runProjectTest = function (buildAppExecutable, e2e) {
  if (shouldSkipProjectTest()) {
    console.log('skipping project test')

    return Promise.resolve()
  }

  return new Promise((resolve, reject) => {
    const env = _.omit(process.env, 'CYPRESS_INTERNAL_ENV')

    if (!canRecordVideo()) {
      console.log('cannot record video on this platform yet, disabling')
      env.CYPRESS_VIDEO_RECORDING = 'false'
    }

    const args = [
      `--run-project=${e2e}`,
      `--spec=${e2e}/cypress/e2e/simple_passing.cy.js`,
    ]

    if (verify.needsSandbox()) {
      args.push('--no-sandbox')
    }

    const options = {
      stdio: 'inherit', env,
    }

    console.log('running project test')
    console.log(buildAppExecutable, args.join(' '))

    return cp.spawn(buildAppExecutable, args, options)
    .on('exit', (code) => {
      if (code === 0) {
        return resolve()
      }

      return reject(new Error(`running project tests failed with: '${code}' errors.`))
    })
  })
}

const runFailingProjectTest = function (buildAppExecutable, e2e) {
  if (shouldSkipProjectTest()) {
    console.log('skipping failing project test')

    return Promise.resolve()
  }

  console.log('running failing project test')

  const verifyScreenshots = function () {
    const screenshot1 = path.join(e2e, 'cypress', 'screenshots', 'simple_failing.cy.js', 'simple failing spec -- fails1 (failed).png')
    const screenshot2 = path.join(e2e, 'cypress', 'screenshots', 'simple_failing.cy.js', 'simple failing spec -- fails2 (failed).png')

    return Promise.all([
      fs.statAsync(screenshot1),
      fs.statAsync(screenshot2),
    ])
  }

  const spawn = () => {
    return new Promise((resolve, reject) => {
      const env = _.omit(process.env, 'CYPRESS_INTERNAL_ENV')

      const args = [
        `--run-project=${e2e}`,
        `--spec=${e2e}/cypress/e2e/simple_failing.cy.js`,
      ]

      if (verify.needsSandbox()) {
        args.push('--no-sandbox')
      }

      const options = {
        stdio: 'inherit',
        env,
      }

      return cp.spawn(buildAppExecutable, args, options)
      .on('exit', (code) => {
        if (code === 2) {
          return resolve()
        }

        return reject(new Error(`running project tests failed with: '${code}' errors.`))
      })
    })
  }

  return spawn()
  .then(verifyScreenshots)
}

const runV8SnapshotProjectTest = function (buildAppExecutable, e2e) {
  if (shouldSkipProjectTest()) {
    console.log('skipping failing project test')

    return Promise.resolve()
  }

  console.log('running v8 snapshot project test')

  const spawn = () => {
    return new Promise((resolve, reject) => {
      const env = _.omit(process.env, 'CYPRESS_INTERNAL_ENV')

      const args = [
        `--run-project=${e2e}`,
        `--spec=${e2e}/cypress/e2e/simple_v8_snapshot.cy.js`,
      ]

      if (verify.needsSandbox()) {
        args.push('--no-sandbox')
      }

      const options = {
        stdio: 'inherit',
        env,
      }

      return cp.spawn(buildAppExecutable, args, options)
      .on('exit', (code) => {
        if (code === 0) {
          return resolve()
        }

        return reject(new Error(`running project tests failed with: '${code}' errors.`))
      })
    })
  }

  return spawn()
}

const test = async function (buildAppExecutable) {
  await scaffoldCommonNodeModules()
  await Fixtures.scaffoldProject('e2e')
  const e2e = Fixtures.projectPath('e2e')

  await runSmokeTest(buildAppExecutable)
  await runProjectTest(buildAppExecutable, e2e)
  await runFailingProjectTest(buildAppExecutable, e2e)
  if (!['1', 'true'].includes(process.env.DISABLE_SNAPSHOT_REQUIRE)) {
    await runV8SnapshotProjectTest(buildAppExecutable, e2e)
  }

  Fixtures.remove()
}

module.exports = {
  test,
}

if (require.main === module) {
  const buildAppExecutable = path.join(__dirname, `../../build/${os.platform()}-unpacked/Cypress`)

  console.log('Script invoked directly, running smoke tests.')
  test(buildAppExecutable)
}
