let session = require('supertest-session');
let should = require('should');
let app = require('./bootstrap');
let request = session(app);

let config = require('../config.models.js');
let db = require('../../src/db').getDb();

let credentialService, userService, applicationService;

describe('Functional Test Client Credentials grant', function () {
  let originalAppConfig, originalOauthConfig;
  let fromDbUser1, fromDbApp;

  before(function (done) {
    originalAppConfig = config.applications;
    originalOauthConfig = config.credentials.types.oauth;

    config.applications.properties = {
      name: { isRequired: true, isMutable: true },
      redirectUri: { isRequired: true, isMutable: true }
    };

    config.credentials.types.oauth = {
      passwordKey: 'secret'
    };

    credentialService = require('../../src/credentials/credential.service.js')(config);
    userService = require('../../src/consumers/user.service.js')(config);
    applicationService = require('../../src/consumers/application.service.js')(config);

    db.flushdbAsync()
    .then(function (didSucceed) {
      if (!didSucceed) {
        console.log('Failed to flush the database');
      }
      let user1 = {
        username: 'irfanbaqui',
        firstname: 'irfan',
        lastname: 'baqui',
        email: 'irfan@eg.com'
      };

      userService.insert(user1)
      .then((_fromDbUser1) => {
        should.exist(_fromDbUser1);
        fromDbUser1 = _fromDbUser1;

        let app1 = {
          name: 'irfan_app',
          redirectUri: 'https://some.host.com/some/route'
        };

        applicationService.insert(app1, fromDbUser1.id)
        .then(_fromDbApp => {
          should.exist(_fromDbApp);
          fromDbApp = _fromDbApp;

          return credentialService.insertCredential(fromDbApp.id, 'oauth', { secret: 'app-secret' })
          .then(appRes => {
            should.exist(appRes);
            done();
          });
        });
      });
    })
    .catch(function (err) {
      should.not.exist(err);
      done();
    });
  });

  after((done) => {
    config.applications = originalAppConfig;
    config.credentials.types.oauth = originalOauthConfig;
    done();
  });

  it('should grant access token', function (done) {
    request
    .post('/oauth2/token')
    .send({
      grant_type: 'client_credentials',
      client_id: fromDbApp.id,
      client_secret: 'app-secret'
    })
    .expect(200)
    .end(function (err, res) {
      should.not.exist(err);
      let token = res.body;
      should.exist(token);
      should.exist(token.access_token);
      token.token_type.should.equal('Bearer');
      done();
    });
  });
});