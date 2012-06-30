function Reinvent() {
  var args = Array.prototype.slice.call(arguments),
  callback = args.pop(),
  modules = (args[0] && typeof args[0] === "string") ? args : args[0],
  config,
  i;

  if (!(this instanceof Reinvent)) {
    return new Reinvent(modules, callback);
  }

  if (!modules || modules === '*') {
    modules = [];
    for (i in Reinvent.modules) {
      if (Reinvent.modules.hasOwnProperty(i)) {
        modules.push(i);
      }
    }
  }

  for (i = 0; i < modules.length; i += 1) {
    Reinvent.modules[modules[i]](this);
  }

  callback(this);
  return this;
}

Reinvent.modules = {};

Reinvent.modules.app = function(reinvent) {

  reinvent.app = {};

  reinvent.app.Instance = Class.extend({
    init: function(map, options) {
      reinvent.log.info('app init');
      this.options = _.defaults(options, {
          logging: false
      });
      reinvent.log.enabled = options ? options.logging: false;
      this._map = map;
      this.maplayer = new reinvent.maplayer.Engine(this._map, {})
    },
    run: function() {
        this.maplayer.run();
        reinvent.log.info('app running');
    }
  });
};

Reinvent.modules.maplayer = function(reinvent) {
    reinvent.maplayer = {};
    reinvent.maplayer.Engine = Class.extend({
        init: function(map, options) {
            reinvent.log.info('map engine init');
            var that = this;
            this._map = map;
        },
        run: function(){
            this.panToUser();
            this.setupListeners();
        },
        setupListeners: function(){
            // TODO: listen for pin clicks
        }
        dropPin: function(){
            // TODO
        },
        panToUser: function(){
            var that = this;
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    function(position){
                        that.locationSuccess(position);
                    }, 
                    this.locationFail);
            } 
        },
        locationSuccess: function(position){
    	    var lat = position.coords.latitude;
    	    var lng = position.coords.longitude;
		    var latlng = new google.maps.LatLng(lat, lng);
            this._map.setCenter(latlng);
        },
        locationFail: function(position){
            // pass
        },
    });
    reinvent.maplayer.Display = Class.extend({
        /**
         * Constructs a new Display with the given DOM element.
         */
        init: function(map) {
            this._map = map;
        },
        setEngine: function(engine) {
            this._engine = engine;
        },
        addPin: function(pin) {
            // TODO
        }
    });
}
/**
 * Logging module that reinventtes log messages to the console
 *
 */
Reinvent.modules.log = function(reinvent) {
  reinvent.log = {};

  reinvent.log.info = function(msg) {
    reinvent.log._reinventte('INFO: ' + msg);
  };

  reinvent.log.warn = function(msg) {
    reinvent.log._reinventte('WARN: ' + msg);
  };

  reinvent.log.error = function(msg) {
    reinvent.log._reinventte('ERROR: ' + msg);
  };

  reinvent.log.todo = function(msg) {
    reinvent.log._reinventte('TODO: '+ msg);
  };

  reinvent.log._reinventte = function(msg) {
    var logger = window.console;
    if (reinvent.log.enabled) {
      if (logger && logger.markTimeline) {
        logger.markTimeline(msg);
      }
      //console.log(msg);
    }
  };
};
