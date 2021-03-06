/*
 * Copyright (c) 2018 Parallax Inc.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software
 * and associated documentation files (the “Software”), to deal in the Software without
 * restriction, including without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or
 * substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

package com.parallax.server.blocklyprop.services.impl;

import com.google.common.base.Preconditions;
import com.google.common.base.Strings;
import com.google.inject.Inject;
import com.google.inject.Provider;
import com.google.inject.Singleton;
import com.google.inject.persist.Transactional;

import com.parallax.client.cloudsession.CloudSessionAuthenticateService;
import com.parallax.client.cloudsession.CloudSessionRegisterService;
import com.parallax.client.cloudsession.CloudSessionUserService;
import com.parallax.client.cloudsession.exceptions.EmailNotConfirmedException;
import com.parallax.client.cloudsession.exceptions.InsufficientBucketTokensException;
import com.parallax.client.cloudsession.exceptions.NonUniqueEmailException;
import com.parallax.client.cloudsession.exceptions.PasswordComplexityException;
import com.parallax.client.cloudsession.exceptions.PasswordVerifyException;
import com.parallax.client.cloudsession.exceptions.ScreennameUsedException;
import com.parallax.client.cloudsession.exceptions.ServerException;
import com.parallax.client.cloudsession.exceptions.UnknownUserException;
import com.parallax.client.cloudsession.exceptions.UnknownUserIdException;
import com.parallax.client.cloudsession.exceptions.UserBlockedException;
import com.parallax.client.cloudsession.exceptions.WrongAuthenticationSourceException;
import com.parallax.client.cloudsession.objects.User;

import com.parallax.server.blocklyprop.SessionData;
import com.parallax.server.blocklyprop.db.dao.UserDao;
import com.parallax.server.blocklyprop.services.SecurityService;

import com.parallax.server.blocklyprop.db.generated.tables.records.UserRecord;

import java.util.Calendar;
import java.util.Set;
import org.apache.commons.configuration.Configuration;
import org.apache.commons.validator.routines.EmailValidator;
import org.apache.shiro.SecurityUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * User security services
 * 
 * @author Michel
 */
@Singleton
@Transactional
public class SecurityServiceImpl implements SecurityService {

    /**
     * Handle to logging facility
     */
    private static final Logger LOG = LoggerFactory.getLogger(SecurityServiceImpl.class);
    
    /**
     * 
     */
    private static SecurityServiceImpl instance;

    /**
     * Web client session details
     */
    private Provider<SessionData> sessionData;

    /**
     * Application configuration settings
     */
    private Configuration configuration;
    
    /**
     * 
     */
    private EmailValidator emailValidator = EmailValidator.getInstance();

    /**
     * Interface to the Cloud Session user account registration service
     */
    private CloudSessionRegisterService registerService;
    
    /**
     * Interface to the Cloud Session user authentication service
     */
    private CloudSessionAuthenticateService authenticateService;
    
    /**
     * Interface to the Cloud Session user account/profile services
     */
    private CloudSessionUserService userService;

    /**
     *  Access to the BlocklyProp user details
     */
    private UserDao userDao;
    
    /**
     * Constructor
     * 
     */
    public SecurityServiceImpl() {
        // TODO: Correct the 'this' construct in the constructor
        //
        // Notes from: https://www.securecoding.cert.org/confluence/display/java/TSM01-J.+Do+not+let+the+this+reference+escape+during+object+construction 
        //
        // Publishing by assigning this to a public static variable from the 
        // constructor of a class whose object is being constructed.
        //-------------------------------------------------------------------
        instance = this;
    }

    /**
     * Set the session's data provider
     * 
     * This is a callback used by the Shiro package to provide a connection
     * between the application and the Shiro session management services.
     * 
     * @param sessionDataProvider 
     */
    @Inject
    public void setSessionDataProvider(Provider<SessionData> sessionDataProvider) {
        this.sessionData = sessionDataProvider;
    }

    /**
     * Set the session's user database object in the blocklyprop system.
     * 
     * @param userDao 
     */
    @Inject
    public void setUserDao(UserDao userDao) {
        this.userDao = userDao;
    }

    /**
     * Configure cloud session service endpoints
     * 
     * @param configuration 
     */

    @Inject
    public void setConfiguration(Configuration configuration) {
        LOG.debug("Setting cloud session configuration");
        this.configuration = configuration;

        // Set the source for the cloud session registration services
        registerService = new CloudSessionRegisterService(
                configuration.getString("cloudsession.server"), 
                configuration.getString("cloudsession.baseurl"));
        
        // Set the source for cloud session user authentication  services
        authenticateService = new CloudSessionAuthenticateService(
                configuration.getString("cloudsession.server"), 
                configuration.getString("cloudsession.baseurl"));
        
        // Set the source location for cloud session existing local user
        // account services
        userService = new CloudSessionUserService(
                configuration.getString("cloudsession.baseurl"));
    }

    /**
     * Validate new user data and create a new user account
     * 
     * Details:
     * If the request passes all validity tests, create a user account
     * in the cloud session system. If that account is created successfully, 
     * create a user record in the blocklyprop system from data stored in
     * the cloud session user record.
     * 
     * @param screenname String user screen name
     * @param email String user email address
     * @param password String user password
     * @param passwordConfirm String user password confirmation
     * @param birthMonth int Month component of user's birthday. COPPA field
     * @param birthYear int Year component of the user's birthday. COPPA field
     * @param parentEmail String sponsor email address. COPPA field
     * @param parentEmailSource int Sponsor classification. COPPA
     * @return
     * @throws NonUniqueEmailException
     * @throws PasswordVerifyException
     * @throws PasswordComplexityException
     * @throws ScreennameUsedException
     * @throws IllegalStateException 
     */
    @Override
    public Long register(
            String screenname, 
            String email, 
            String password, 
            String passwordConfirm,
            int birthMonth,
            int birthYear,
            String parentEmail,
            int parentEmailSource) throws 
                NonUniqueEmailException, 
                PasswordVerifyException, 
                PasswordComplexityException, 
                ScreennameUsedException,
                IllegalStateException{

        User user = new User();

        // Log a few things
        LOG.debug("In register: parameter screen name: {}", screenname);
        LOG.debug("In register: parameter email: {}", email);
        LOG.debug("In register: parameter month: {}", birthMonth);
        LOG.debug("In register: parameter year: {}", birthYear);
        LOG.debug("In register: parameter sponsor email: {}", parentEmail);
        LOG.debug("In register: parameter sponsor type selection: {}", parentEmailSource);
        
        // Perform basic sanity checks on inputs
        // Throws NullPointerException if screenname is null
        LOG.debug("Resgistering new user: {}", screenname);
        Preconditions.checkNotNull(screenname, "ScreenNameNull");

        // User email address is required and must be reasonably valid
        LOG.debug("Verifying email address has been supplied");
        Preconditions.checkNotNull(email, "UserEmailNull");

        LOG.debug("Verifying email address is reasonable");
        Preconditions.checkState(
                emailValidator.isValid(email),
                "Email address format is incorrect");

        LOG.debug("Verifying that a password was provided");
        Preconditions.checkNotNull(password, "PasswordIsNull");
        
        LOG.debug("Verify that second copy of password was provided");
        Preconditions.checkNotNull(passwordConfirm, "PasswordConfirmIsNull");
 
        // Verify that we have valid COPPA data before continuing
        // Birth month
        Preconditions.checkNotNull(birthMonth, "BirthMonthNull");
        LOG.debug("Verify that month is provided: {}", birthMonth);
        Preconditions.checkState((birthMonth != 0), "BirthMonthNotSet");

        // Birth year
        Preconditions.checkNotNull(birthYear, "BirthYearNull");
        LOG.debug("Verify that year is provided: {}", birthYear);
        Preconditions.checkState(
                (Calendar.getInstance().get(Calendar.YEAR) != birthYear),
                "BirthYearNotSet");

        // Get additional information if the registrant is under 13 years old
        if (user.isCoppaEligible(birthMonth, birthYear)) {
            LOG.debug("User is subject to COPPA regulations");

            // We must have a sponsor email address for COPPA eligible users
            Preconditions.checkNotNull(
                    parentEmail,
                    "SponsorEmailNull");
            
            // Verify that the sponsor email address is reasonable
            if (parentEmail != null && parentEmail.length() > 0) {
                LOG.debug("Verify that optional user email address is reasonable");
                Preconditions.checkState(
                    emailValidator.isValid(parentEmail),
                    "SponsorEmail");
            }
        }

        try {
            // Attempt to register the user account data with the cloud session
            // service. If successful, the method call will return a cloud
            // session user id for the newly created account
            LOG.info("Registering user account with cloud-service");
            Long idCloudSessionUser = registerService.registerUser(
                    email, 
                    password, 
                    passwordConfirm, 
                    "en", 
                    screenname,
                    birthMonth, 
                    birthYear, 
                    parentEmail, 
                    parentEmailSource);
            
            // Create a BlocklyProp user account record
            if (idCloudSessionUser > 0) {
                userDao.create(idCloudSessionUser, screenname);
            }
            
            return idCloudSessionUser;
        }
        catch (ServerException se) {
            LOG.error("Server error detected");
            return 0L;
        }
        catch (NullPointerException npe) {
            LOG.error("New user registration failed with: {}", npe.getMessage() );
            return 0L;
        }
    }


    /**
     *  Get instance of an authenticated user object
     * 
     * @param email
     * @param password
     * @return Authenticated User object or null
     * @throws UnknownUserException
     * @throws UserBlockedException
     * @throws EmailNotConfirmedException
     * @throws InsufficientBucketTokensException
     * @throws WrongAuthenticationSourceException 
     */
    @Inject
    public static User authenticateLocalUserStatic(
            String email, 
            String password) throws
                UnknownUserException, 
                UserBlockedException, 
                EmailNotConfirmedException, 
                InsufficientBucketTokensException, 
                WrongAuthenticationSourceException,
                ServerException {

        LOG.info("Authenticating user from email address");

        return instance.authenticateLocalUser(email, password);
    }

    /**
     * Authenticate a user from the provided userID
     * 
     * @param idUser
     * 
     * @return
     * @throws UnknownUserIdException
     * @throws UserBlockedException
     * @throws EmailNotConfirmedException 
     */
    @Inject
    public static User authenticateLocalUserStatic(Long idUser) throws 
            UnknownUserIdException, 
            UserBlockedException, 
            EmailNotConfirmedException {
        
        LOG.info("Authenticating user from userID");
        return instance.authenticateLocalUser(idUser);
    }

    /**
     * Authenticate a user login using the local user authentication database
     *
     * @param email
     * @param password
     * @return
     * @throws UnknownUserException
     * @throws UserBlockedException
     * @throws EmailNotConfirmedException
     * @throws InsufficientBucketTokensException
     * @throws WrongAuthenticationSourceException
     * @throws NullPointerException
     *
     */
    @Override
    public User authenticateLocalUser(String email, String password) throws
            UnknownUserException,
            UserBlockedException, 
            EmailNotConfirmedException, 
            InsufficientBucketTokensException, 
            WrongAuthenticationSourceException,
            NullPointerException,
            ServerException {
        
        try {
            LOG.info("Attempting to authenticate {}", email);

            // Query Cloud Session interface
            User user = authenticateService.authenticateLocalUser(email, password);
            LOG.info("User authenticated");
            return user;

        } catch (UnknownUserException uue) {
            LOG.error("User account is unknown.");
            throw uue;
        } catch (UserBlockedException ube) {
            LOG.error("User account is blocked.");
            throw ube;

        } catch (EmailNotConfirmedException enc) {
            LOG.error("Attempt to log into an unconfirmed account.");
            throw enc;

        } catch (InsufficientBucketTokensException ibte) {
            LOG.error("Number of consecutive login attempts has been exceeded.");
            throw ibte;

        } catch (WrongAuthenticationSourceException wase) {
            LOG.error("Attempting to authenticate to the wrong authentication source.");
            throw wase;

        } catch (NullPointerException npe) {
            LOG.error("Authetication threw Null Pointer Exception");
            throw npe;

        } catch (ServerException se) {
            LOG.error("Server error encountered: {}", se.getMessage());
            throw se;
        }
    }

    /**
     * 
     * @param idUser
     * This is the primary key from the cloudsession.user table.
     *
     * @return
     * Returns a User object if successful. Otherwise it throws an appropriate exception.
     *
     * @throws UnknownUserIdException
     * User account does not exist
     *
     * @throws UserBlockedException
     * User account is locked and unavailable
     *
     * @throws EmailNotConfirmedException
     * User account registration is incomplete. The account is unavailable.
     */
    public User authenticateLocalUser(Long idUser) throws 
            UnknownUserIdException, 
            UserBlockedException, 
            EmailNotConfirmedException {
        
        try {
            User user = userService.getUser(idUser);
            LOG.info("User authenticated");
            return user;

        } catch (NullPointerException npe) {
            throw npe;

        } catch (ServerException se) {
            LOG.error("Server error detected. {}", se.getMessage());
            return null;
        }
    }

    /**
     * Return user session data
     * 
     * @return SessionData object containing user session details or null
     */
    public static SessionData getSessionData() {
        LOG.debug("Getting user session data");
        
        SessionData sessionData = instance.sessionData.get();
        
        if (sessionData == null) {
            LOG.warn("Error obtaining session data");
        }
        
        LOG.debug("Session data - {}", sessionData.toString());
        
        // Check for a BP user id
        if (sessionData.getIdUser() == null) {
            
            // No BP user id found, is the user in this session authenticated?
            if (SecurityUtils.getSubject().isAuthenticated()) {
                
                // The user identified by this session is authenticated. Perform
                // a fun exercise to locate the BP user id for this authenticated
                // user.
                LOG.debug("Session data missing a valid BP id for an authenticated user");
                
                try {
                    // Getting a user record using the account email address
                    String principal = (String) SecurityUtils.getSubject().getPrincipal();
                    // Display the user's email address
                    LOG.debug("Getting pricipal: {}", principal );
                    
                    // Get the user account/profile record
                    User user = instance.userService.getUser(
                            (String) SecurityUtils.getSubject().getPrincipal());
                    
                    // Did we get a user account object
                    if (user != null) {
                        LOG.debug("Session User: {}", user.getScreenname());
                        LOG.debug("Session UserId: {}", user.getId());
                        LOG.debug("Session locale: {}", user.getLocale());
                        
                        // Yes, User account local may have changed
                        if (!Strings.isNullOrEmpty(sessionData.getLocale())) {
                            if (!sessionData.getLocale().equals(user.getLocale())) {
                                try {
                                    // User locale changed. Let's update the user 
                                    // account with new locale
                                    LOG.info("Changing user {} locale", user.getScreenname());
                                    user = instance.userService.changeUserLocale(
                                            user.getId(), sessionData.getLocale());
                                } catch (UnknownUserIdException ex) {
                                    LOG.error("UnknownUserId exception detected. {}", ex.getMessage());
                                }
                            }
                        }
                        
                        LOG.debug("Setting session user data for {}", user.getScreenname());
                        sessionData.setUser(user);       
                        
                        LOG.debug("Getting BP user id");
                        UserRecord bpUser = instance.userDao.getUser(user.getId(), user.getScreenname());
                        if (bpUser != null) {
                            LOG.debug("Setting BP user id to: {}", bpUser.getId());
                            sessionData.setIdUser(bpUser.getId());                            
                        }else{
                            LOG.warn("Warning! Setting BP user id to zero");
                            sessionData.setIdUser(0L);
                        }

                        /*
                         * This should never be necessary until the user profile page
                         * offers the capability to change the user's screen name
                         */
//                        instance.userDao.updateScreenname(
//                                sessionData.getIdUser(), 
//                                user.getScreenname());
                    }
                } catch (UnknownUserException ex) {
                    LOG.error("Unknown user ID. {}", ex);
                } catch (ServerException se) {
                    LOG.error("Server error detected. {}", se.getMessage());
                }
            }
        }
        return sessionData;
    }
}
