(function($, undefined){
    $.widget('surfjudge.heat_timer', {
        options: {
            heat_id: null,
            heat_duration: null,
            data: null,
        },

        _create: function(){
            this._init_html();
            this.refresh();
        },

        _destroy: function(){
            this.element.empty();
        },

        _init_html: function(){
            var _this = this;
            html = $([
                '<h1 class="heat_time">00:00',
                '</h1>',
            ].join(' '));

            this.element.append(html);
        },

        refresh: function(){
            var _this = this;
            var deferred = $.Deferred();
            $.getJSON('/headjudge/do_get_remaining_heat_time', {heat_id: this.options.heat_id})
                .done(function(remaining_heat_time_s){
                    var now = new Date();
                    if (remaining_heat_time_s === null){
                        _this.options.heat_end_time = null;
                    } else {
                        _this.options.heat_end_time = new Date(now.getTime() + remaining_heat_time_s * 1000);
                    }
                    _this._refresh();
                    deferred.resolve();
                })
                .fail(function(){
                    _this.options.heat_end_time = null;
                    _this._refresh();
                    deferred.reject();
                });
            return deferred.promise();
        },

        _refresh: function(){
            var _this = this;
            if (this._heat_timer !== null)
                clearInterval(this._heat_timer);
            this._heat_timer = setInterval(function(){_this._update_heat_time_display();}, 1000);
            this._update_heat_time_display();
        },

        _update_heat_time_display: function(){
            if (this.options.heat_end_time === null){
                this.element.find('.heat_time').text(this.options.heat_duration + ':00');
            } else {
                var now = new Date();
                var heat_time = Math.ceil((this.options.heat_end_time.getTime() - now.getTime())/1000);
                if (heat_time < 0)
                    heat_time = 0;
                var minutes = '' + parseInt(heat_time / 60);
                var seconds = '' + parseInt(heat_time % 60);
                while (seconds.length < 2) seconds = '0' + seconds;
                while (minutes.length < 2) minutes = '0' + minutes;
                this.element.find('.heat_time').text(minutes + ':' + seconds);
            }
        },
    });

}(jQuery));
