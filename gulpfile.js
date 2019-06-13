var gulp = require('gulp')
var concat = require('gulp-concat')
var sourcemaps = require('gulp-sourcemaps')
var uglify = require('gulp-uglify')

gulp.task('build', function () {
  var files = [
      './src/PiNote/main.js',
      './src/PiNote/*.js',
      './src/PinBoard/main.js',
      './src/PinBoard/*.js'
    ];

  gulp.src(files)
    .pipe(sourcemaps.init())
      .pipe(concat('pinote.js'))
    .pipe(sourcemaps.write())
    .pipe(gulp.dest('./dist'))

  gulp.src(files)
    .pipe(sourcemaps.init())
      .pipe(concat('pinote.min.js'))
      .pipe(uglify())
    .pipe(sourcemaps.write())
    .pipe(gulp.dest('./dist'))
})
