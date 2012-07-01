
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

var fetchTweets = function(hashtag) {
  $.getJSON("http://search.twitter.com/search.json?include_entities=true&rpp=12&result_type=recent&q=green&callback=?",
         function(jsonData) {console.log(jsonData)});
}

Reinvent.modules = {};

Reinvent.modules.app = function(reinvent) {

  reinvent.app = {};

  reinvent.app.Instance = Class.extend({
    init: function(map, options) {
      this.options = _.defaults(options, {
          logging: false,
          table: 'reinvent_lots',
          domain: 'ecohack12'
      });
      reinvent.log.enabled = options ? options.logging: false;
      reinvent.log.info('app init');
      this._map = map;
      //TODO we can split each of these up, to run only what we need for a particular view
      this.maplayer = new reinvent.maplayer.Engine(this._map, {});
      this.imguruploader = new reinvent.imguruploader.Engine(this.options.imgur_form_id);
      this.datalayer = new reinvent.datalayer.Engine(this._map, {});
      this.twitter = new reinvent.twitter.Engine("#rainbow");
      this.hash = null;
      //EXAMPLE call how to get data to make new profile page
    },
    run: function() {
        this.hash = this.getHash();
        this.maplayer.run();
        this.imguruploader.run();
        this.twitter.run();
        Reinvent.app.lot = new reinvent.lot.Engine({});
        Reinvent.app.lot.run();
        if (this.hash==null){
            this.randomLot(function(data){
                Reinvent.app.lot.gotoLot(data.rows[0].hash);
            });
        } else {
            this.gotoHash(this.hash);
        }
        reinvent.log.info('app running');
        $("#userFormAdd").submit(function() {
          Reinvent.app.logImage($("#userFormAdd"));
          var imgur_callback = function(imgur_data) {
            //TODO add new image to gallery
            Reinvent.app.addToPlace(this, imgur_data);
          }
          Reinvent.app.imguruploader.addImage(
              $("#imgur_upload input[type=file]")[0].files[0],
              imgur_callback
          );
          return false; // prevents actual HTTP submit
        });
        $("#userForm").submit(function() {
          Reinvent.app.logImage($("#userForm"));
          var imgur_callback = function(imgur_data) {
            Reinvent.app.createPlace(this, imgur_data);
          }
          Reinvent.app.imguruploader.uploadImage(
              $("#imgur_upload input[type=file]")[0].files[0],
              imgur_callback
          );
          return false; // prevents actual HTTP submit
        });
        $("#map_icon_link").click(function() {
          $("section#front_page").toggle();
        });
    },
    gotoHash: function(hash){
        this.hash = hash;
        Reinvent.app.lot.gotoLot(this.hash);
        location.hash = "#"+this.hash;
        var sql = "SELECT ST_X(the_geom) lng, ST_Y(the_geom) lat, address, name, hash, imgur_small FROM "+this.options.table+" WHERE the_geom IS NOT NULL AND hash = '"+this.hash+"'";
        $.ajax({
          type: 'post',
          dataType: 'json',
          url: "http://"+this.options.domain+".cartodb.com/api/v2/sql?q="+sql,
          success: function(data){Reinvent.app.loadLot(data)}
        });
        //this.datalayer.gotoHash(this.hash);
        //this.maplayer.gotoHash(this.hash);
          // this.maplayer = new reinvent.maplayer.Engine(this._map, {});
          // this.imguruploader = new reinvent.imguruploader.Engine(this.options.imgur_form_id);
          // this.datalayer = new reinvent.datalayer.Engine(this._map, {});
    },
    loadLot: function(data){
        if (data.rows.length==1){
            var latLng = new google.maps.LatLng(data.rows[0]['lat'],data.rows[0]['lng']);
            Reinvent.app.datalayer.clearMarkers();
            Reinvent.app.datalayer.getNearestLots(function(data){Reinvent.app.datalayer.plotLots(data)}, this.hash);
            Reinvent.app.maplayer.loadLot(latLng,data.rows[0]['address']);
        }
    },
    getHash: function(){
        var h = window.location.href.slice(window.location.href.indexOf('#')).replace('#','');
        if (h=='/'){ h = null};
        return h
    },
    randomLot: function(callback){
        // For use in the homepage to get a random-popular lot for gallery and display
        var sql = "WITH f AS (SELECT hash, count(*) c, random() r FROM "+this.options.table+" GROUP BY hash  ORDER BY c desc LIMIT 6) SELECT hash FROM f ORDER BY r LIMIT 1";
        $.ajax({
          type: 'post',
          dataType: 'json',
          url: "http://"+this.options.domain+".cartodb.com/api/v2/sql?q="+sql,
          success: callback
        });
    },
    logImage: function(form){
        reinvent.log.info(form);
        reinvent.log.info('blocked');
    },
    getName: function(){
        return $('#place_name').val();
    },
    createPlace: function(form, imgur_data) {
      reinvent.log.info('Uploaded to imgur! ' + imgur_data.upload.links.imgur_page);
      var create_params = {};
      var place_location = Reinvent.app.maplayer.getLocation();
      create_params["lat"] = place_location[0];
      create_params["lng"] = place_location[1];
      create_params["name"] = this.getName();
      create_params["address"] = Reinvent.app.maplayer.getAddress();
      create_params["orig"] = imgur_data.upload.links.original;
      create_params["small"] = imgur_data.upload.links.large_thumbnail;
      create_params["thumb"] = imgur_data.upload.links.small_square;
      reinvent.log.info(create_params)
      $.ajax({
        type: "POST",
        url: "/api/create",
        data:  create_params,//JSON.stringify(create_params)
      }).done( function(data) {
        //TODO go to the page for the new hash
        reinvent.log.info("created! :: lot = " + data.hash);
      });
    },
    addToPlace: function(form, imgur_data) {
      reinvent.log.info('Uploaded to imgur! ' + imgur_data.upload.links.imgur_page);
      var create_params = {};
      var place_location = Reinvent.app.maplayer.getLocation();
      create_params["lat"] = place_location[0];
      create_params["lng"] = place_location[1];
      create_params["orig"] = imgur_data.upload.links.original;
      create_params["small"] = imgur_data.upload.links.large_thumbnail;
      create_params["thumb"] = imgur_data.upload.links.small_square;
      reinvent.log.info(create_params)
      $.ajax({
        type: "POST",
        url: "/api/add",
        data:  create_params,//JSON.stringify(create_params)
      }).done( function(data) {
        //TODO go to the page for the new hash
        reinvent.log.info("added! :: lot = " + data.hash);
      });
    }
  });
};

Reinvent.modules.twitter = function(reinvent) {
    reinvent.twitter = {};
    reinvent.twitter.Engine = Class.extend({
        init: function(lotHashArg) {
          this.lotHash = lotHashArg;
        },
        run: function() {
        },
        fetchTweets: function(hashtag, callback) {
          $.getJSON("http://search.twitter.com/search.json?include_entities=true&rpp=12&result_type=recent" +
                    "&q=" + encodeURI(hashtag) +
                    "&callback=?",
                    callback);
        }
    });
} // + encodeURI(this.lotHash) +

Reinvent.modules.imguruploader = function(reinvent) {
    reinvent.imguruploader = {};
    reinvent.imguruploader.Engine = Class.extend({
        init: function(divid) {
            this._divid = divid;
        },
        run: function(){
        },
        uploadImage: function(file, callback){
            if (!file || !file.type.match(/image.*/)) return;

            var fd = new FormData();
            fd.append("image", file);
            fd.append("key", "3e1abddad6fba082f7d20aa9ea3ef783");

            var xhr = new XMLHttpRequest();
            xhr.open("POST", "http://api.imgur.com/2/upload.json");
            xhr.onload = function() {
               var parsedResponse = JSON.parse(xhr.responseText);
               callback(parsedResponse);
            }

            xhr.send(fd);
        }
    });
}

Reinvent.modules.lot = function(reinvent) {
    reinvent.lot = {};
    reinvent.lot.Engine = Class.extend({
        init: function(options) {
          this.options = _.defaults(options, {
              table: 'reinvent_lots',
              domain: 'ecohack12'
          });
          this.lotHash = null;
        },
        run: function(){
        },
        gotoLot: function(hash){
            this.lotHash = hash;
            $('#fake-gallery #images').html('');
            this.getOverview(function(data){Reinvent.app.lot.populatePage(data)});
            this.getImages(function(data){Reinvent.app.lot.populateGallery(data)});
            this.updateHash();
        },
        updateHash: function() {
          Reinvent.app.twitter.fetchTweets(this.lotHash, this.renderTweet);
        },
        renderTweet: function(data) {
          console.log(data);
        },
        getOverview: function(callback){
            $.ajax({
              type: 'post',
              dataType: 'json',
              url: "http://"+this.options.domain+".cartodb.com/api/v2/sql?q="+this._overviewSql(),
              success: callback
            });
        },
        populatePage: function(data){
            // TODO fill title etc dom with this information
            reinvent.log.info(data.rows[0].name + ": " + data.rows[0].address );
            $('#fake-gallery #name').html(data.rows[0].name);
            $('#fake-gallery #address').html(data.rows[0].address);
        },
        getImages: function(callback){
            $.ajax({
              type: 'post',
              dataType: 'json',
              url: "http://"+this.options.domain+".cartodb.com/api/v2/sql?q="+this._imagesSql(),
              success: callback
            });
        },
        populateGallery: function(data){
            // TODO fill gallery dom with this information
            for (var i = 0; i<data.rows.length; i++){
                reinvent.log.info("Thumb: "+data.rows[i].imgur_thumb);
                var img = new Image();
                img.src=data.rows[i].imgur_thumb;
                var d = $("<div></div>");
                d.attr('id', 'img-thumb');
                // TODO show large d.click( function(e){} , function(e)  )
                d.append(img)
                $('#fake-gallery #images').append(d);
            }
        },
        _imagesSql: function(){
            return "SELECT cartodb_id, ST_X(the_geom) lng, ST_Y(the_geom) lat, hash, imgur_small, imgur_thumb, imgur_orig FROM "+this.options.table+" WHERE hash = '"+this.lotHash+"' ORDER BY created_at desc"
        },
        _overviewSql: function(){
            return "SELECT ST_X(the_geom) lng, ST_Y(the_geom) lat, hash, address, name FROM "+this.options.table+" WHERE hash = '"+this.lotHash+"' AND the_geom IS NOT NULL ORDER BY created_at asc LIMIT 1"
        }
    });
}


Reinvent.modules.datalayer = function(reinvent) {
    reinvent.datalayer = {};
    reinvent.datalayer.Engine = Class.extend({
        init: function(options) {
          this.options = _.defaults(options, {
              nlots: 10,
              table: 'reinvent_lots',
              domain: 'ecohack12'
          });
          this.markers = [];
        },
        getSql: function(hash){
            var place_location = Reinvent.app.maplayer.getLocation();
            var cond = '';
            if (hash != null){
                cond = " AND hash != '"+hash+"' ";
            }
            return "SELECT ST_X(the_geom) lng, ST_Y(the_geom) lat, address, name, hash, imgur_small FROM "+this.options.table+" WHERE the_geom IS NOT NULL "+cond+" ORDER BY the_geom <-> st_setsrid(st_makepoint("+place_location[1]+","+place_location[0]+"),4326) LIMIT "+this.options.nlots
        },
        getNearestLots: function(callback, hash){
            $.ajax({
              type: 'post',
              dataType: 'json',
              url: "http://"+this.options.domain+".cartodb.com/api/v2/sql?q="+this.getSql(hash),
              success: callback
            });
        },
        plotLots: function(lots){
            for (var i=0; i<lots.rows.length; i++){
                var marker = Reinvent.app.maplayer.newMarker(lots.rows[i]);
                this.markers.push(marker);
            }
        },
        clearMarkers: function(){
            for (var i=0;i<this.markers.length;i++){
                this.markers[i].setMap(null);
                delete this.markers[i]
            }
            this.markers = [];
        }
    });
}

Reinvent.modules.maplayer = function(reinvent) {
    reinvent.maplayer = {};
    reinvent.maplayer.Engine = Class.extend({
        init: function(map, options) {
            reinvent.log.info('map engine init');
            var that = this;
            this._map = map;
            this.lat = null;
            this.lng = null;
            this.marker = null;
            this.lotMarker = null; //for when in lotview
            this.address = null;
            this._geocoder = new google.maps.Geocoder();
            this._surrounding = "/images/markerR_alt.png";
            this._central = "/images/markerR.png";
        },
        run: function(){
            this.panToUser();
            this.setupListeners();
            Reinvent.app.datalayer.getNearestLots(function(data) {
                Reinvent.app.datalayer.plotLots(data);
            });
            this.addPinIcon();
        },
        loadLot: function(latLng,address){
          // Pin is the user generated marker
          if ( this.lotMarker ) {
            this.lotMarker.setMap(null);
            this.lotMarker = null;
          }
            this.lotMarker = new google.maps.Marker({
              position: latLng,
              map: this._map,
              animation: google.maps.Animation.DROP,
              icon: this._central,
              draggable: false
            });
    	  this.lat = latLng.lat();
    	  this.lng = latLng.lng();
    	  Reinvent.app.maplayer.setAddress(address)
          this._map.setCenter(latLng);
        },
        setupListeners: function(){
            // 
        },
        setAddress: function(address){
            $('#current_address').html(address.split(',')[0]);
            this.address = address;
        },
        getAddress: function(){
            return this.address
        },
        centerPin: function(latLng){
          this.marker.setPosition(this._map.getCenter());  
    	  this.lat = this._map.getCenter().lat();
    	  this.lng = this._map.getCenter().lng();
          this._geocoder.geocode({location: this._map.getCenter()}, function(addresses){
              if (addresses.length>0){
                  Reinvent.app.maplayer.setAddress(addresses[0].formatted_address);
              }
          })
        },
        dropPin: function(){
          var latLng = this._map.getCenter();
          
            Reinvent.app.datalayer.clearMarkers();
            Reinvent.app.datalayer.getNearestLots(function(data){Reinvent.app.datalayer.plotLots(data)}, this.hash);
          // Pin is the user generated marker
          if ( this.marker ) {
            this.marker.setPosition(latLng);
          } else {
            this.marker = new google.maps.Marker({
              position: latLng,
              map: this._map,
              animation: google.maps.Animation.DROP,
              icon: this._central,
              draggable: false
            });
          }
          
          google.maps.event.addListener(this._map, 'dragend', function() {
              Reinvent.app.maplayer.centerPin();
          });
          
    	  this.lat = latLng.lat();
    	  this.lng = latLng.lng();
          this._geocoder.geocode({location: latLng}, function(addresses){
              Reinvent.app.maplayer.setAddress(addresses[0].formatted_address)
          })
          this._map.setCenter(latLng);
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
    	    this.lat = position.coords.latitude;
    	    this.lng = position.coords.longitude;
		    var latLng = new google.maps.LatLng(this.lat, this.lng);
            this._geocoder.geocode({location: latLng}, function(addresses){
                Reinvent.app.maplayer.setAddress(addresses[0].formatted_address);
            });
            this._map.setCenter(latLng);
        },
        locationFail: function(position){
            // pass
        },
        newMarker: function(data){
		    var latLng = new google.maps.LatLng(data.lat, data.lng);
            var newMarker = new google.maps.Marker({
              position: latLng,
              map: this._map,
              icon: this._surrounding,
              title: data.address
            });
            newMarker.metadata = {hash: data.hash};
            google.maps.event.addListener(newMarker, 'click', function(e) {
                Reinvent.app.gotoHash(this.metadata['hash'])
              });
            
            return newMarker;
        },
        getLocation: function(position) {
          return [this.lat, this.lng];
        },
        addPinIcon: function(){
            var controlDiv = document.createElement('div');
            $(controlDiv).css({'cursor': 'pointer',
                              'textAlign': 'center',
                              'background': 'none',
                              'margin-right': '3px',
                              'margin-top': '3px',
                              'filter': 'alpha (opacity=50)'});
            controlDiv.title = 'Drop pin';
            var controlUI = document.createElement('div');
            $(controlUI).css({'cursor': 'pointer',
                              'textAlign': 'center',
                              'background': 'none',
                              'filter': 'alpha (opacity=50)'});
            controlUI.title = 'Drop pin';
            controlDiv.appendChild(controlUI);
            controlDiv.index = 1;
            var control = $('<img />');
            control.attr('src','/images/dropR.png');
            control.attr('alt','drop pin');
            control.css({'height': '30px', 'width': '30px'});
            $(controlDiv).append(control);
            google.maps.event.addDomListener(controlDiv, 'click', function(event) {
                reinvent.log.info('drop clicked');
              Reinvent.app.maplayer.dropPin();
            });
            this._map.controls[google.maps.ControlPosition.TOP_RIGHT].push(controlDiv);
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
      console.log(msg);
    }
  };
};
