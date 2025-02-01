const passport=require("passport");
const GoogleStrategy=require("passport-google-oauth20").Strategy
const User=require("../models/userSchema");
const env=require("dotenv").config();



passport.use(new GoogleStrategy(
    {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: '/auth/google/callback',
    },
    async (accessToken, refreshToken, profile, done) => {
        console.log("kkjhksjdh")
        try {
          
            let user = await User.findOne({ googleId: profile.id });

            if (user) {
                return done(null, user);
            } else {
                console.log("else")
                const newUser = new User({
                    name: profile.displayName,
                    email: profile.emails?.[0]?.value || '', 
                    googleId: profile.id,
                });
                console.log(newUser)
   
                await newUser.save();
                console.log("New user created:", newUser);
                return done(null, newUser);
            }
        } catch (error) {
           
            console.error("Error in Google OAuth strategy:", error);
            return done(error, null);
        }
    }
));

passport.serializeUser((user,done)=>{
    console.log("jh")
    done(null,user.id)
});

passport.deserializeUser((id,done)=>{
    User.findById({_id:id})
    .then(user=>{
        done(null,user)
    })
    .catch(err=>{
        done(err,null)
    })
})


module.exports=passport;